/**
 * Earth Information Jukebox — Data Synth Engine
 *
 * Implements createDataSynth() conforming to Phase 2 specification contract:
 * - synth.setRegion(region)
 * - synth.setYear(year)
 * - synth.play()
 * - synth.pause()
 * - synth.setVoice(name, enabled)
 * - synth.voices -> [{ name, label, enabled, value, unit }]
 * - synth.playSweep({ from, to, secondsPerYear = 0.6 })
 * - synth.compare(yearA, yearB, { secondsEach = 4 })
 * - synth.on('year' | 'caption' | 'compare', cb)
 * - synth.describe(year) -> plain-language caption with exact values + units
 */

import * as Tone from 'tone';
import { VARIABLES, VARIABLE_MAP, formatValue } from './ranges.js';
import { VoicePipeline } from './voices.js';

// Import engine audio if present (Phase 1 master bus)
let engineAudio = null;
let engineInitAudio = null;
try {
  const mod = await import('../engine/audio.js');
  engineAudio = mod.audio;
  engineInitAudio = mod.initAudio;
} catch {
  // Running standalone
}

export function createDataSynth() {
  // Own output stage: volume -> limiter -> speakers. The shared engine bus is
  // created lazily, so it is not reliable here, and seven voices plus reverb
  // can sum above full scale without a limiter.
  const limiter = new Tone.Limiter(-3).toDestination();
  const outGain = new Tone.Gain(0).connect(limiter);
  let volume = 0.8;
  const masterBus = outGain;
  const pipeline = new VoicePipeline(masterBus);
  const fadeTo = (v, t = 0.15) => outGain.gain.rampTo(v * 0.55, t);

  let currentRegion = null;
  let currentYear = null;
  let currentYearData = null;
  let isPlaying = false;

  // Active timers for sweep and compare
  let sweepTimer = null;
  let compareTimer = null;
  let comparePhase = 'A';

  // Event listeners
  const listeners = {
    year: new Set(),
    caption: new Set(),
    compare: new Set()
  };

  function emit(event, data) {
    if (listeners[event]) {
      for (const cb of listeners[event]) {
        try {
          cb(data);
        } catch (err) {
          console.error(`DataSynth listener error on "${event}":`, err);
        }
      }
    }
  }

  function stopTimers() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      clearTimeout(sweepTimer);
      sweepTimer = null;
    }
    if (compareTimer) {
      clearInterval(compareTimer);
      clearTimeout(compareTimer);
      compareTimer = null;
    }
  }

  function getYearData(yr) {
    if (!currentRegion || !Array.isArray(currentRegion.years)) {
      return null;
    }
    const targetYr = Number(yr);
    return currentRegion.years.find(y => Number(y.year) === targetYr) || null;
  }

  const synth = {
    /**
     * Master bus reference in use.
     */
    masterBus,

    /**
     * Whether audio playback is currently running.
     */
    get isPlaying() {
      return isPlaying;
    },

    /**
     * Get current region object.
     */
    get currentRegion() {
      return currentRegion;
    },

    /**
     * Get current numeric year.
     */
    get currentYear() {
      return currentYear;
    },

    /**
     * Array of voice descriptors with live values and units:
     * [{ name, label, enabled, value, unit }]
     */
    get voices() {
      return VARIABLES.map(v => {
        const val = currentYearData && currentYearData[v.name] !== undefined
          ? currentYearData[v.name]
          : null;
        return {
          name: v.name,
          label: v.label,
          enabled: pipeline.enabledState[v.name],
          value: val,
          unit: v.unit
        };
      });
    },

    /**
     * Set the active region.
     * @param {object} region - Region object from regions.json
     */
    setRegion(region) {
      currentRegion = region;
      stopTimers();

      if (!region || !Array.isArray(region.years) || region.years.length === 0) {
        currentYear = null;
        currentYearData = null;
        pipeline.updateValues(null);
        emit('year', { year: null, data: null, region: currentRegion });
        emit('caption', this.describe());
        return;
      }

      // Preserve existing year if available in new region, else select first
      const exists = region.years.some(y => Number(y.year) === currentYear);
      const targetYear = exists ? currentYear : Number(region.years[0].year);

      this.setYear(targetYear);
    },

    /**
     * Set the active year.
     * @param {number|string} year - 4-digit year (e.g. 1981, 2024)
     */
    setYear(year) {
      const yr = Number(year);
      currentYear = yr;
      currentYearData = getYearData(yr);

      pipeline.updateValues(currentYearData);
      pipeline.onYearStep();

      emit('year', {
        year: currentYear,
        data: currentYearData,
        region: currentRegion
      });

      emit('caption', this.describe(currentYear));
    },

    /**
     * Toggle voice on/off.
     * @param {string} name - Variable voice name (e.g. 'tempC', 'precipMm')
     * @param {boolean} enabled
     */
    setVoice(name, enabled) {
      if (pipeline.enabledState[name] !== undefined) {
        pipeline.setVoiceEnabled(name, enabled);
      }
    },

    /**
     * Start audio playback.
     */
    async play() {
      // Resume Web Audio and Tone.js on user gesture
      if (engineInitAudio) {
        try {
          await engineInitAudio();
        } catch {}
      } else {
        try {
          await Tone.start();
          const ctx = Tone.getContext();
          if (ctx && ctx.state !== 'running') {
            await ctx.resume();
          }
        } catch {}
      }

      isPlaying = true;
      fadeTo(volume, 0.1);
      pipeline.start();

      // Ensure voices are updated to current year
      if (currentYearData) {
        pipeline.updateValues(currentYearData);
      }
    },

    /**
     * Pause / stop audio playback.
     */
    pause() {
      stopTimers();
      isPlaying = false;
      fadeTo(0, 0.15); // cut reverb and pad tails too
      pipeline.stop();
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (isPlaying) fadeTo(volume, 0.05);
    },

    /**
     * Auto-advance through years from `from` to `to` at given speed.
     * @param {{ from?: number, to?: number, secondsPerYear?: number }} options
     */
    playSweep({ from, to, secondsPerYear = 0.6 } = {}) {
      if (!currentRegion || !Array.isArray(currentRegion.years) || currentRegion.years.length === 0) {
        return;
      }

      stopTimers();

      const yearsList = currentRegion.years.map(y => Number(y.year)).sort((a, b) => a - b);
      const startYear = from !== undefined ? Number(from) : yearsList[0];
      const endYear = to !== undefined ? Number(to) : yearsList[yearsList.length - 1];
      const stepIntervalMs = Math.max(100, (Number(secondsPerYear) || 0.6) * 1000);

      // Collect target years in order
      const direction = startYear <= endYear ? 1 : -1;
      const sequence = [];
      for (let y = startYear; direction > 0 ? y <= endYear : y >= endYear; y += direction) {
        if (yearsList.includes(y)) {
          sequence.push(y);
        }
      }

      if (sequence.length === 0) {
        sequence.push(startYear);
      }

      let stepIndex = 0;
      this.setYear(sequence[stepIndex]);
      this.play();

      sweepTimer = setInterval(() => {
        stepIndex++;
        if (stepIndex >= sequence.length) {
          // Reached end of sweep
          clearInterval(sweepTimer);
          sweepTimer = null;
          return;
        }
        this.setYear(sequence[stepIndex]);
      }, stepIntervalMs);

      return {
        stop: () => stopTimers()
      };
    },

    /**
     * Alternate playback between two years for audible comparison.
     * @param {number} yearA - First comparison year
     * @param {number} yearB - Second comparison year
     * @param {{ secondsEach?: number }} options
     */
    compare(yearA, yearB, { secondsEach = 4 } = {}) {
      if (!currentRegion || !Array.isArray(currentRegion.years)) {
        return;
      }

      stopTimers();

      const yA = Number(yearA);
      const yB = Number(yearB);
      const durationMs = Math.max(500, (Number(secondsEach) || 4) * 1000);

      comparePhase = 'A';
      this.setYear(yA);
      this.play();

      emit('compare', {
        phase: 'A',
        year: yA,
        otherYear: yB,
        secondsEach: durationMs / 1000,
        data: getYearData(yA),
        region: currentRegion
      });

      compareTimer = setInterval(() => {
        if (comparePhase === 'A') {
          comparePhase = 'B';
          this.setYear(yB);
          emit('compare', {
            phase: 'B',
            year: yB,
            otherYear: yA,
            secondsEach: durationMs / 1000,
            data: getYearData(yB),
            region: currentRegion
          });
        } else {
          comparePhase = 'A';
          this.setYear(yA);
          emit('compare', {
            phase: 'A',
            year: yA,
            otherYear: yB,
            secondsEach: durationMs / 1000,
            data: getYearData(yA),
            region: currentRegion
          });
        }
      }, durationMs);

      return {
        stop: () => stopTimers()
      };
    },

    /**
     * Subscribe to synth events.
     * Supported events: 'year', 'caption', 'compare'
     * @param {'year'|'caption'|'compare'} event
     * @param {Function} cb
     * @returns {Function} Unsubscribe function
     */
    on(event, cb) {
      if (listeners[event] && typeof cb === 'function') {
        listeners[event].add(cb);
      }
      return () => this.off(event, cb);
    },

    /**
     * Unsubscribe from synth events.
     */
    off(event, cb) {
      if (listeners[event]) {
        listeners[event].delete(cb);
      }
    },

    /**
     * Plain-language caption with exact values and units for screen readers and Voice Guide.
     * @param {number|string} [year] - Defaults to currently selected year
     * @returns {string} Plain-language description
     */
    describe(year) {
      const yr = year !== undefined ? Number(year) : currentYear;
      const data = yr !== null ? getYearData(yr) : null;
      const regionName = currentRegion ? currentRegion.name : 'Unknown Region';

      if (!yr || !data) {
        return currentRegion
          ? `${regionName}: No data available for year ${yr || 'selected'}.`
          : 'No region selected.';
      }

      const metrics = [
        `Temperature ${formatValue('tempC', data.tempC)}`,
        `Precipitation ${formatValue('precipMm', data.precipMm)}`,
        `Solar Irradiance ${formatValue('solar', data.solar)}`,
        `Wind Speed ${formatValue('windMs', data.windMs)}`,
        `Humidity ${formatValue('humidity', data.humidity)}`,
        `Atmospheric CO₂ ${formatValue('co2ppm', data.co2ppm)}`,
        `Global Temp Anomaly ${formatValue('globalAnomalyC', data.globalAnomalyC)}`
      ];

      return `${regionName} (${yr}): ${metrics.join(', ')}.`;
    },

    /**
     * Clean up and release all audio nodes and timers.
     */
    dispose() {
      this.pause();
      pipeline.dispose();
      for (const key of Object.keys(listeners)) {
        listeners[key].clear();
      }
    }
  };

  return synth;
}
