/**
 * Earth Information Jukebox — Data Synth Multi-Voice Synthesis Pipeline
 *
 * Implements the 7 variable voices per Phase 2 specification:
 * 1. tempC: Lead pitch (scale-snapped, warmer = higher)
 * 2. precipMm: Plucked pentatonic note density
 * 3. solar: Shimmer / high pad brightness
 * 4. windMs: Filtered noise colour
 * 5. humidity: Reverb wet
 * 6. co2ppm: Pad detune tension (0 → +35 cents)
 * 7. globalAnomalyC: Slow sub drone pitch drift
 *
 * Null handling: Any variable with a null/undefined value produces NO sound.
 * Toggles: Each voice has an independent on/off toggle.
 */

import * as Tone from 'tone';
import { normalizeVariable } from './ranges.js';
import { snapToNote, getScaleNotes } from './scales.js';

export class VoicePipeline {
  constructor(masterBus) {
    this.masterBus = masterBus || Tone.getDestination();
    this.initialized = false;
    this.isPlaying = false;

    // Enabled state per voice
    this.enabledState = {
      tempC: true,
      precipMm: true,
      solar: true,
      windMs: true,
      humidity: true,
      co2ppm: true,
      globalAnomalyC: true
    };

    // Current raw values
    this.currentValues = {
      tempC: null,
      precipMm: null,
      solar: null,
      windMs: null,
      humidity: null,
      co2ppm: null,
      globalAnomalyC: null
    };

    // Scheduled timer references
    this.clockTimer = null;
    this.leadTimer = null;
    this.clockTickCount = 0;
  }

  /**
   * Lazily initialize audio graph upon user gesture / playback.
   */
  initNodes() {
    if (this.initialized) return;

    try {
      // Shared Reverb Node governed by humidity
      this.reverb = new Tone.Freeverb({
        roomSize: 0.72,
        dampening: 2800
      });
      this.reverb.wet.value = 0.2;
      this.reverb.connect(this.masterBus);

      // --- 1. tempC: Lead Synth ---
      this.leadGain = new Tone.Gain(0.7);
      this.leadSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.05,
          decay: 0.28,
          sustain: 0.45,
          release: 0.7
        }
      });
      this.leadSynth.connect(this.leadGain);
      this.leadGain.connect(this.reverb);

      // --- 2. precipMm: Pluck Synth ---
      this.pluckGain = new Tone.Gain(0.65);
      this.pluckSynth = new Tone.PluckSynth({
        attackNoise: 1.1,
        dampening: 3800,
        resonance: 0.88
      });
      this.pluckSynth.connect(this.pluckGain);
      this.pluckGain.connect(this.reverb);

      // --- 3 & 6. solar & co2ppm: Shimmer High Pad ---
      this.solarFilter = new Tone.Filter({
        frequency: 1000,
        type: 'lowpass',
        rolloff: -24
      });
      this.solarChorus = new Tone.Chorus({
        frequency: 2.2,
        delayTime: 3.5,
        depth: 0.55
      }).start();

      this.solarGain = new Tone.Gain(0);
      this.solarSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 6,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'sawtooth8' },
          envelope: {
            attack: 1.0,
            decay: 1.2,
            sustain: 0.85,
            release: 1.8
          }
        }
      });
      this.solarSynth.connect(this.solarFilter);
      this.solarFilter.connect(this.solarChorus);
      this.solarChorus.connect(this.solarGain);
      this.solarGain.connect(this.reverb);

      // Pad chord notes (Airy celestial open chord)
      this.padNotes = ['E4', 'B4', 'E5', 'G#5'];
      this.padSounding = false;

      // --- 4. windMs: Filtered Noise Colour ---
      this.windGain = new Tone.Gain(0);
      this.windFilter = new Tone.Filter({
        frequency: 350,
        type: 'bandpass',
        Q: 1.4
      });
      this.windNoise = new Tone.Noise('pink');
      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterBus);

      // --- 7. globalAnomalyC: Sub Drone ---
      this.subGain = new Tone.Gain(0);
      this.subFilter = new Tone.Filter({
        frequency: 95,
        type: 'lowpass'
      });
      this.subOsc = new Tone.Oscillator({
        frequency: 40,
        type: 'sine'
      });
      this.subOsc.connect(this.subFilter);
      this.subFilter.connect(this.subGain);
      // Connect sub drone directly to master bus to keep sub-bass clear and crisp
      this.subGain.connect(this.masterBus);

      this.initialized = true;
    } catch (err) {
      console.warn('DataSynth: AudioContext not ready yet or error creating nodes:', err);
    }
  }

  /**
   * Set voice enabled toggle.
   */
  setVoiceEnabled(name, enabled) {
    this.enabledState[name] = Boolean(enabled);
    this.applyVoiceState(name);
  }

  /**
   * Update all voice values from current year record.
   */
  updateValues(data) {
    if (!data) {
      for (const key of Object.keys(this.currentValues)) {
        this.currentValues[key] = null;
        this.applyVoiceState(key);
      }
      return;
    }

    for (const key of Object.keys(this.currentValues)) {
      this.currentValues[key] = data[key] !== undefined ? data[key] : null;
      this.applyVoiceState(key);
    }
  }

  /**
   * Update audio parameters for a single voice based on its current value and enabled state.
   */
  applyVoiceState(name) {
    if (!this.initialized) return;

    const isEnabled = this.enabledState[name];
    const rawVal = this.currentValues[name];
    const norm = normalizeVariable(name, rawVal);
    const hasValue = norm !== null && isEnabled;

    switch (name) {
      case 'tempC': {
        // Handled dynamically in melodic lead scheduler
        if (!hasValue && this.isPlaying) {
          // Immediately stop any sustained tone
          try {
            this.leadSynth.triggerRelease(Tone.now());
          } catch {}
        }
        break;
      }

      case 'precipMm': {
        // Handled in rhythm tick scheduler
        break;
      }

      case 'solar': {
        if (!hasValue || !this.isPlaying) {
          this.solarGain.gain.rampTo(0, 0.15);
          if (this.padSounding) {
            try {
              this.solarSynth.releaseAll();
              this.padSounding = false;
            } catch {}
          }
        } else {
          // Filter cutoff from 350 Hz (dim, cold) to 7500 Hz (blazing solar radiance)
          const cutoff = 350 * Math.pow(7500 / 350, norm);
          this.solarFilter.frequency.rampTo(cutoff, 0.25);
          const targetGain = 0.25 + norm * 0.25;
          this.solarGain.gain.rampTo(targetGain, 0.25);

          if (!this.padSounding) {
            try {
              this.solarSynth.triggerAttack(this.padNotes, Tone.now());
              this.padSounding = true;
            } catch {}
          }
        }
        break;
      }

      case 'windMs': {
        if (!hasValue || !this.isPlaying) {
          this.windGain.gain.rampTo(0, 0.15);
        } else {
          // Bandpass center frequency: 180 Hz to 2400 Hz
          const centerFreq = 180 + Math.pow(norm, 1.4) * 2200;
          this.windFilter.frequency.rampTo(centerFreq, 0.25);
          // Bandpass Q: narrower at low wind, wider whoosh at high wind
          const qVal = Math.max(0.8, 2.0 - norm * 1.1);
          this.windFilter.Q.rampTo(qVal, 0.25);

          const targetGain = 0.03 + norm * 0.22;
          this.windGain.gain.rampTo(targetGain, 0.25);
        }
        break;
      }

      case 'humidity': {
        if (!hasValue) {
          // Default dry acoustic space
          this.reverb.wet.rampTo(0.08, 0.2);
        } else {
          // Reverb wet: 0.05 (arid Sahel) to 0.72 (humid Amazon/Reef)
          const wetVal = 0.05 + norm * 0.67;
          this.reverb.wet.rampTo(wetVal, 0.2);
        }
        break;
      }

      case 'co2ppm': {
        if (!hasValue) {
          try {
            this.solarSynth.set({ detune: 0 });
            this.leadSynth.detune.rampTo(0, 0.2);
          } catch {}
        } else {
          // Detune from 0 cents up to +35 cents
          const cents = norm * 35;
          try {
            this.solarSynth.set({ detune: cents });
            this.leadSynth.detune.rampTo(cents * 0.35, 0.2);
          } catch {}
        }
        break;
      }

      case 'globalAnomalyC': {
        if (!hasValue || !this.isPlaying) {
          this.subGain.gain.rampTo(0, 0.15);
        } else {
          // Sub frequency: 36 Hz (historical cold) to 76 Hz (high anomaly)
          const subFreq = 36 + norm * 40;
          this.subOsc.frequency.rampTo(subFreq, 0.4);
          this.subGain.gain.rampTo(0.42, 0.3);
        }
        break;
      }
    }
  }

  /**
   * Start playback.
   */
  start() {
    this.initNodes();
    if (!this.initialized) return;

    this.isPlaying = true;

    // Start oscillators & noise generator if not already running
    try {
      if (this.windNoise.state !== 'started') {
        this.windNoise.start();
      }
      if (this.subOsc.state !== 'started') {
        this.subOsc.start();
      }
    } catch {}

    // Apply all voice states immediately
    for (const key of Object.keys(this.currentValues)) {
      this.applyVoiceState(key);
    }

    // Start rhythmic pluck scheduler & lead pulse
    this.startSchedulers();
  }

  /**
   * Stop / pause playback.
   */
  stop() {
    this.isPlaying = false;
    this.stopSchedulers();

    if (!this.initialized) return;

    try {
      // Fade out gains and release notes
      this.leadGain.gain.rampTo(0, 0.1);
      this.pluckGain.gain.rampTo(0, 0.1);
      this.solarGain.gain.rampTo(0, 0.1);
      this.windGain.gain.rampTo(0, 0.1);
      this.subGain.gain.rampTo(0, 0.1);

      if (this.padSounding) {
        this.solarSynth.releaseAll();
        this.padSounding = false;
      }
      this.leadSynth.triggerRelease(Tone.now());
    } catch {}
  }

  /**
   * Start precision interval clock for plucks & lead notes.
   */
  startSchedulers() {
    this.stopSchedulers();

    // Clock ticks every 125 ms (8 ticks per second)
    this.clockTickCount = 0;
    this.clockTimer = setInterval(() => {
      this.onClockTick();
    }, 125);

    // Lead pulse triggers every 1.5 seconds (or immediately on year step)
    this.leadTimer = setInterval(() => {
      this.triggerLeadNote();
    }, 1500);

    // Initial lead trigger
    this.triggerLeadNote();
  }

  stopSchedulers() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (this.leadTimer) {
      clearInterval(this.leadTimer);
      this.leadTimer = null;
    }
  }

  /**
   * Called on each 125 ms clock tick: handles precipitation pluck density.
   */
  onClockTick() {
    if (!this.isPlaying || !this.initialized) return;
    this.clockTickCount++;

    const isEnabled = this.enabledState.precipMm;
    const rawPrecip = this.currentValues.precipMm;
    const norm = normalizeVariable('precipMm', rawPrecip);

    if (norm === null || !isEnabled || norm <= 0.001) {
      return; // Silent
    }

    // Density determines probability of a pluck on this 125ms tick
    // High precip (Amazon ~2500 mm, norm ~0.83) -> ~70% chance per tick (~5.6 plucks/sec)
    // Low precip (Sahel ~300 mm, norm ~0.10) -> ~8% chance per tick (~0.6 plucks/sec)
    const pluckProbability = Math.min(0.85, 0.05 + norm * 0.8);

    if (Math.random() < pluckProbability) {
      const plucks = getScaleNotes('pluckScale');
      // Pick note from pentatonic pluck scale
      const noteIdx = Math.floor(Math.random() * plucks.length);
      const note = plucks[noteIdx];
      // Velocity scales with precipitation intensity
      const velocity = Math.min(1.0, 0.4 + norm * 0.55);

      try {
        this.pluckGain.gain.rampTo(0.65, 0.02);
        this.pluckSynth.triggerAttack(note, Tone.now(), velocity);
      } catch {}
    }
  }

  /**
   * Triggers the lead pitch corresponding to tempC.
   */
  triggerLeadNote(articulation = '8n') {
    if (!this.isPlaying || !this.initialized) return;

    const isEnabled = this.enabledState.tempC;
    const rawTemp = this.currentValues.tempC;
    const norm = normalizeVariable('tempC', rawTemp);

    if (norm === null || !isEnabled) {
      return; // Silent
    }

    // Snap to lead pentatonic scale note: colder = low, warmer = high
    const note = snapToNote(norm, 'leadScale');
    if (!note) return;

    try {
      this.leadGain.gain.rampTo(0.7, 0.02);
      this.leadSynth.triggerAttackRelease(note, articulation, Tone.now());
    } catch {}
  }

  /**
   * Called when year advances (e.g. during sweep or manual scrubber):
   * immediately triggers an audible melodic chime for the new temperature.
   */
  onYearStep() {
    if (this.isPlaying) {
      this.triggerLeadNote('4n');
    }
  }

  /**
   * Dispose all audio nodes cleanly.
   */
  dispose() {
    this.stop();

    const nodes = [
      this.leadSynth, this.leadGain,
      this.pluckSynth, this.pluckGain,
      this.solarSynth, this.solarFilter, this.solarChorus, this.solarGain,
      this.windNoise, this.windFilter, this.windGain,
      this.subOsc, this.subFilter, this.subGain,
      this.reverb
    ];

    for (const node of nodes) {
      if (node && typeof node.dispose === 'function') {
        try {
          node.dispose();
        } catch {}
      }
    }
    this.initialized = false;
  }
}
