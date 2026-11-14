/**
 * Earth Information Jukebox — Data Synth Engine
 *
 * Implements createDataSynth() conforming to Phase 2 specification contract & audio brief:
 * - synth.setRegion(region)
 * - synth.setYear(year)
 * - synth.play()
 * - synth.pause()
 * - synth.setVoice(name, enabled)
 * - synth.voices -> [{ name, label, enabled, value, unit }]
 * - synth.playSweep({ from, to, secondsPerYear = 0.6 })
 * - synth.compare(yearA, yearB, { secondsEach = 4 })
 * - synth.on('year' | 'caption' | 'compare' | 'end', cb)
 * - synth.describe(year) -> plain-language caption with exact values + units
 *
 * Sound-Design Upgrades:
 * - Real sampled instruments (Tone.Sampler with CC-BY 3.0 concert harp & flute)
 * - Convolution / studio reverb with rapid silence damping on pause (< 0.2s)
 * - Per-place musical identity (key, mode, and rain-derived tempo)
 * - Smooth parameter gliding during sweeps (portamento, sub drone glide)
 * - Stereo spread per voice with optional control (synth.setStereoSpread)
 * - Clear compare sound with distinctive two-tone transition chime
 * - Strict loudness safety (true peak <= 0.8, -18 LUFS, onsets <= 6 dB)
 * - Switchable experimental variants (synth.setVariant)
 */

import * as Tone from 'tone';
import { VARIABLES, formatValue } from './ranges.js';
import { VoicePipeline } from './voices.js';

// Import engine audio if present (Phase 1 master bus)
let engineInitAudio = null;
try {
  const mod = await import('../engine/audio.js');
  engineInitAudio = mod.initAudio;
} catch {
  // Standalone
}

export function createDataSynth() {
  // Output stage: calibrated volume gain -> safety limiter (-4 dBFS) -> destination
  // Gain calibrated to keep true peak <= 0.8 and LUFS between -19 and -16
  const limiter = new Tone.Limiter(-4).toDestination();
  const outGain = new Tone.Gain(0).connect(limiter);
  let volume = 0.8;
  const masterBus = outGain;
  const pipeline = new VoicePipeline(masterBus);

  // Calibrated master fade: 0.42 ceiling ensures peak linear <= 0.78
  const fadeTo = (v, t = 0.12) => {
    try {
      outGain.gain.rampTo(v * 0.42, t);
    } catch {}
  };

  let currentRegion = null;
  let currentYear = null;
  let currentYearData = null;
  let isPlaying = false;
  let isSweeping = false;

  // Active timers for sweep and compare
  let sweepTimer = null;
  let compareTimer = null;
  let comparePhase = 'A';

  // Event listeners
  const listeners = {
    year: new Set(),
    caption: new Set(),
    compare: new Set(),
    end: new Set()
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
    isSweeping = false;
  }

  function getYearData(yr) {
    if (!currentRegion || !Array.isArray(currentRegion.years)) {
      return null;
    }
    const targetYr = Number(yr);
    return currentRegion.years.find((y) => Number(y.year) === targetYr) || null;
  }

  const synth = {
    /**
     * Master bus reference in use.
     */
    masterBus,

    /**
     * Underlying multi-voice pipeline.
     */
    pipeline,

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
     * Current place's musical identity (key, mode, baseBpm).
     */
    get musicalIdentity() {
      return pipeline.identity;
    },

    /**
     * Array of voice descriptors with live values and units:
     * [{ name, label, enabled, value, unit }]
     */
    get voices() {
      return VARIABLES.map((v) => {
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
     * Derives per-place musical identity (key/mode from mean temperature, tempo from rainfall).
     * @param {object} region - Region object from regions.json
     */
    setRegion(region) {
      currentRegion = region;
      stopTimers();
      pipeline.setRegion(region);

      if (!region || !Array.isArray(region.years) || region.years.length === 0) {
        currentYear = null;
        currentYearData = null;
        pipeline.updateValues(null);
        emit('year', { year: null, data: null, region: currentRegion });
        emit('caption', this.describe());
        return;
      }

      // Preserve existing year if available in new region, else select first
      const exists = region.years.some((y) => Number(y.year) === currentYear);
      const targetYear = exists ? currentYear : Number(region.years[0].year);

      this.setYear(targetYear);
    },

    /**
     * Set the active year.
     * @param {number|string} year - 4-digit year (e.g. 1981, 2024)
     * @param {object} [options]
     */
    setYear(year, { isSweep = false, sweepInterval = 0.6 } = {}) {
      const yr = Number(year);
      currentYear = yr;
      currentYearData = getYearData(yr);

      pipeline.updateValues(currentYearData);
      pipeline.onYearStep({ isSweep, sweepInterval });

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
     * Configure stereo spread: 0.0 (mono) to 1.0 (full stereo width).
     */
    setStereoSpread(amount) {
      pipeline.setStereoSpread(amount);
    },

    /**
     * Switch experimental sound-design variant:
     * 'hybrid-sampled' (winner) | 'physical-modeling' | 'cinematic-ambient'
     */
    setVariant(variant) {
      pipeline.setVariant(variant);
    },

    /**
     * Start audio playback.
     */
    async play() {
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

      if (currentYearData) {
        pipeline.updateValues(currentYearData);
      }
    },

    /**
     * Pause / stop audio playback with guaranteed instant silence (< 0.2s).
     */
    pause() {
      stopTimers();
      isPlaying = false;
      fadeTo(0, 0.08); // Rapid master cut to silence
      pipeline.stop();
      emit('end');
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (isPlaying) fadeTo(volume, 0.05);
    },

    /**
     * Auto-advance through years from `from` to `to` at given speed.
     * Features smooth year-to-year pitch gliding and transient suppression.
     * @param {{ from?: number, to?: number, secondsPerYear?: number }} options
     */
    playSweep({ from, to, secondsPerYear = 0.6 } = {}) {
      if (!currentRegion || !Array.isArray(currentRegion.years) || currentRegion.years.length === 0) {
        return;
      }

      stopTimers();

      const yearsList = currentRegion.years.map((y) => Number(y.year)).sort((a, b) => a - b);
      const startYear = from !== undefined ? Number(from) : yearsList[0];
      const endYear = to !== undefined ? Number(to) : yearsList[yearsList.length - 1];
      const stepIntervalMs = Math.max(100, (Number(secondsPerYear) || 0.6) * 1000);
      const stepIntervalSec = stepIntervalMs / 1000;

      const direction = startYear <= endYear ? 1 : -1;
      const sequence = [];
      for (let y = startYear; direction > 0 ? y <= endYear : y >= endYear; y += direction) {
        if (yearsList.includes(y)) {
          sequence.push(y);
        }
      }

      if (sequence.length === 0) sequence.push(startYear);

      isSweeping = true;
      let stepIndex = 0;
      this.setYear(sequence[stepIndex], { isSweep: true, sweepInterval: stepIntervalSec });
      this.play();

      sweepTimer = setInterval(() => {
        stepIndex++;
        if (stepIndex >= sequence.length) {
          clearInterval(sweepTimer);
          sweepTimer = null;
          isSweeping = false;
          emit('end');
          return;
        }
        this.setYear(sequence[stepIndex], { isSweep: true, sweepInterval: stepIntervalSec });
      }, stepIntervalMs);

      return {
        stop: () => {
          stopTimers();
          emit('end');
        }
      };
    },

    /**
     * Alternate playback between two years with clear marker chime between phases.
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

      // Trigger start cue
      pipeline.triggerCompareMarker('start');

      emit('compare', {
        phase: 'A',
        year: yA,
        otherYear: yB,
        secondsEach: durationMs / 1000,
        data: getYearData(yA),
        region: currentRegion
      });

      compareTimer = setInterval(() => {
        // Play clear transition marker chime between years
        pipeline.triggerCompareMarker('transition');

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
        stop: () => {
          stopTimers();
          emit('end');
        }
      };
    },

    /**
     * Subscribe to synth events.
     * Supported events: 'year', 'caption', 'compare', 'end'
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
