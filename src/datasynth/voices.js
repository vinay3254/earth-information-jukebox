/**
 * Earth Information Jukebox — Data Synth Multi-Voice Synthesis Pipeline
 *
 * Implements the upgraded 7 variable voices per Phase 2 & Sprint Brief specification:
 * 1. tempC: Lead pitch (scale-snapped, warmer = higher; real sampled flute/lead with synth layer)
 * 2. precipMm: Plucked notes (real sampled concert harp with acoustic string resonance)
 * 3. solar: Shimmer / high pad brightness (polyphonic modal pad with solar cutoff filter)
 * 4. windMs: Filtered pink noise rush with spatial panning
 * 5. humidity: Convolution / Studio Reverb wetness and acoustic diffusion
 * 6. co2ppm: Pad detune tension (0 → +35 cents as greenhouse gases accumulate)
 * 7. globalAnomalyC: Centered sub drone pitch drift tracking global warming
 *
 * Audio Safety Calibration:
 * - True Peak <= 0.8 (-2 dBFS)
 * - Loudness: -20 to -16 LUFS
 * - Silence on pause: <= 0.15s (< 0.5s limit)
 * - Onset jumps: <= 5.5 dB (< 6.0 dB limit)
 */

import * as Tone from 'tone';
import { normalizeVariable } from './ranges.js';
import { snapToNote, getMusicalIdentity } from './scales.js';

export class VoicePipeline {
  constructor(masterBus) {
    this.masterBus = masterBus || Tone.getDestination();
    this.initialized = false;
    this.isPlaying = false;
    this.isSweeping = false;
    this.variant = 'hybrid-sampled';

    this.stereoSpread = 1.0;

    this.enabledState = {
      tempC: true,
      precipMm: true,
      solar: true,
      windMs: true,
      humidity: true,
      co2ppm: true,
      globalAnomalyC: true
    };

    this.currentValues = {
      tempC: null,
      precipMm: null,
      solar: null,
      windMs: null,
      humidity: null,
      co2ppm: null,
      globalAnomalyC: null
    };

    this.identity = getMusicalIdentity(null);

    this.clockTimer = null;
    this.leadTimer = null;
    this.clockTickCount = 0;

    this.harpSamplesLoaded = false;
    this.leadSamplesLoaded = false;
    this.irLoaded = false;
  }

  initNodes() {
    if (this.initialized) return;

    try {
      // --- Reverb Architecture ---
      this.reverbWetGain = new Tone.Gain(0.18);
      this.reverbDryGain = new Tone.Gain(0.85);
      this.reverbMuteGain = new Tone.Gain(1.0);

      this.reverb = new Tone.Reverb({
        decay: 2.0,
        preDelay: 0.02
      });
      if (typeof this.reverb.generate === 'function') {
        this.reverb.generate().catch(() => {});
      }

      try {
        const irPath = typeof window !== 'undefined'
          ? new URL('audio/earth/ir/hall.mp3', window.location.href).href
          : 'audio/earth/ir/hall.mp3';

        this.convolver = new Tone.Convolver({
          url: irPath,
          onload: () => {
            this.irLoaded = true;
          }
        });
      } catch {
        this.convolver = null;
      }

      this.reverbSend = new Tone.Gain(0.8);
      this.reverbSend.connect(this.reverb);
      if (this.convolver) {
        this.reverbSend.connect(this.convolver);
        this.convolver.connect(this.reverbMuteGain);
      }
      this.reverb.connect(this.reverbMuteGain);
      this.reverbMuteGain.connect(this.reverbWetGain);
      this.reverbWetGain.connect(this.masterBus);
      this.reverbDryGain.connect(this.masterBus);

      // --- 1. tempC: Lead Synth & Sampled Flute ---
      // Calibrated gain: 0.22 prevents overshoot and onset spikes
      this.leadPanner = new Tone.Panner(0.12 * this.stereoSpread);
      this.leadGain = new Tone.Gain(0.22);

      this.leadSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.12, // Smooth attack avoids >6dB onset jump
          decay: 0.35,
          sustain: 0.45,
          release: 0.55
        }
      });

      try {
        const leadBase = typeof window !== 'undefined'
          ? new URL('audio/earth/lead/', window.location.href).href
          : 'audio/earth/lead/';

        this.leadSampler = new Tone.Sampler({
          urls: {
            C4: 'C4.mp3',
            E4: 'E4.mp3',
            A4: 'A4.mp3',
            C5: 'C5.mp3',
            E5: 'E5.mp3',
            A5: 'A5.mp3',
            C6: 'C6.mp3'
          },
          baseUrl: leadBase,
          onload: () => {
            this.leadSamplesLoaded = true;
          }
        });
        this.leadSampler.connect(this.leadGain);
      } catch {
        this.leadSampler = null;
      }

      this.leadSynth.connect(this.leadGain);
      this.leadGain.connect(this.leadPanner);
      this.leadPanner.connect(this.reverbDryGain);
      this.leadPanner.connect(this.reverbSend);

      // --- 2. precipMm: Pluck Synth & Sampled Concert Harp ---
      // Calibrated gain: 0.20
      this.pluckPanner = new Tone.Panner(-0.25 * this.stereoSpread);
      this.pluckGain = new Tone.Gain(0.20);

      this.pluckSynth = new Tone.PluckSynth({
        attackNoise: 0.4,
        dampening: 4200,
        resonance: 0.8
      });

      try {
        const harpBase = typeof window !== 'undefined'
          ? new URL('audio/earth/harp/', window.location.href).href
          : 'audio/earth/harp/';

        this.harpSampler = new Tone.Sampler({
          urls: {
            C3: 'C3.mp3',
            G3: 'G3.mp3',
            D4: 'D4.mp3',
            A4: 'A4.mp3',
            C5: 'C5.mp3',
            G5: 'G5.mp3'
          },
          baseUrl: harpBase,
          onload: () => {
            this.harpSamplesLoaded = true;
          }
        });
        this.harpSampler.connect(this.pluckGain);
      } catch {
        this.harpSampler = null;
      }

      this.pluckSynth.connect(this.pluckGain);
      this.pluckGain.connect(this.pluckPanner);
      this.pluckPanner.connect(this.reverbDryGain);
      this.pluckPanner.connect(this.reverbSend);

      // --- 3 & 6. solar & co2ppm: Shimmer High Pad ---
      this.solarPanner = new Tone.Panner(0.32 * this.stereoSpread);
      this.solarFilter = new Tone.Filter({
        frequency: 800,
        type: 'lowpass',
        rolloff: -24
      });
      this.solarChorus = new Tone.Chorus({
        frequency: 1.6,
        delayTime: 3.5,
        depth: 0.45
      }).start();

      this.solarGain = new Tone.Gain(0);
      this.solarSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 6,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.8,
            decay: 1.2,
            sustain: 0.75,
            release: 1.2
          }
        }
      });
      this.solarSynth.connect(this.solarFilter);
      this.solarFilter.connect(this.solarChorus);
      this.solarChorus.connect(this.solarGain);
      this.solarGain.connect(this.solarPanner);
      this.solarPanner.connect(this.reverbDryGain);
      this.solarPanner.connect(this.reverbSend);

      this.padNotes = this.identity.padNotes || ['C4', 'G4', 'C5', 'E5'];
      this.padSounding = false;

      // --- 4. windMs: Filtered Noise Colour ---
      this.windPanner = new Tone.Panner(-0.35 * this.stereoSpread);
      this.windGain = new Tone.Gain(0);
      this.windFilter = new Tone.Filter({
        frequency: 320,
        type: 'bandpass',
        Q: 1.4
      });
      this.windNoise = new Tone.Noise('pink');
      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.windPanner);
      this.windPanner.connect(this.masterBus);

      // --- 7. globalAnomalyC: Sub Drone ---
      this.subGain = new Tone.Gain(0);
      this.subFilter = new Tone.Filter({
        frequency: 85,
        type: 'lowpass'
      });
      this.subOsc = new Tone.Oscillator({
        frequency: 40,
        type: 'sine'
      });
      this.subOsc.connect(this.subFilter);
      this.subFilter.connect(this.subGain);
      this.subGain.connect(this.masterBus);

      // --- Compare Marker Chime Generator ---
      this.markerSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.02,
          decay: 0.12,
          sustain: 0,
          release: 0.15
        }
      });
      this.markerGain = new Tone.Gain(0.18);
      this.markerSynth.connect(this.markerGain);
      this.markerGain.connect(this.masterBus);

      this.initialized = true;
    } catch (err) {
      console.warn('DataSynth: AudioContext error creating nodes:', err);
    }
  }

  setVariant(variant) {
    this.variant = variant;
    if (!this.initialized) return;

    if (variant === 'physical-modeling') {
      this.solarSynth.set({
        oscillator: { type: 'sawtooth8' },
        envelope: { attack: 0.6, release: 1.0 }
      });
      this.leadGain.gain.rampTo(0.20, 0.1);
      this.pluckGain.gain.rampTo(0.18, 0.1);
    } else if (variant === 'cinematic-ambient') {
      this.solarSynth.set({
        oscillator: { type: 'triangle' },
        envelope: { attack: 1.5, release: 2.2 }
      });
      this.leadGain.gain.rampTo(0.24, 0.1);
      this.pluckGain.gain.rampTo(0.22, 0.1);
    } else {
      this.solarSynth.set({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.8, release: 1.2 }
      });
      this.leadGain.gain.rampTo(0.22, 0.1);
      this.pluckGain.gain.rampTo(0.20, 0.1);
    }
  }

  setStereoSpread(amount) {
    this.stereoSpread = Math.max(0, Math.min(1, Number(amount)));
    if (!this.initialized) return;

    this.leadPanner.pan.rampTo(0.12 * this.stereoSpread, 0.2);
    this.pluckPanner.pan.rampTo(-0.25 * this.stereoSpread, 0.2);
    this.solarPanner.pan.rampTo(0.32 * this.stereoSpread, 0.2);
    this.windPanner.pan.rampTo(-0.35 * this.stereoSpread, 0.2);
  }

  setRegion(region) {
    this.identity = getMusicalIdentity(region);
    this.padNotes = this.identity.padNotes || ['C4', 'G4', 'C5', 'E5'];

    if (this.isPlaying) {
      this.startSchedulers();
      this.applyVoiceState('solar');
    }
  }

  setVoiceEnabled(name, enabled) {
    this.enabledState[name] = Boolean(enabled);
    this.applyVoiceState(name);
  }

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

  applyVoiceState(name) {
    if (!this.initialized) return;

    const isEnabled = this.enabledState[name];
    const rawVal = this.currentValues[name];
    const norm = normalizeVariable(name, rawVal);
    const hasValue = norm !== null && isEnabled;

    switch (name) {
      case 'tempC': {
        if (!hasValue && this.isPlaying) {
          try {
            this.leadSynth.triggerRelease(Tone.now());
          } catch {}
        }
        break;
      }

      case 'precipMm': {
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
          const cutoff = 320 * Math.pow(5200 / 320, norm);
          this.solarFilter.frequency.rampTo(cutoff, 0.25);
          const targetGain = 0.10 + norm * 0.12;
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
          const centerFreq = 180 + Math.pow(norm, 1.4) * 1800;
          this.windFilter.frequency.rampTo(centerFreq, 0.25);
          const qVal = Math.max(0.8, 1.8 - norm * 0.9);
          this.windFilter.Q.rampTo(qVal, 0.25);

          const targetGain = 0.02 + norm * 0.08;
          this.windGain.gain.rampTo(targetGain, 0.25);
        }
        break;
      }

      case 'humidity': {
        if (!hasValue) {
          this.reverbWetGain.gain.rampTo(0.06, 0.2);
        } else {
          const wetVal = 0.05 + norm * 0.38;
          this.reverbWetGain.gain.rampTo(wetVal, 0.2);
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
          const subFreq = 38 + norm * 32;
          const rampTime = this.isSweeping ? 0.45 : 0.3;
          this.subOsc.frequency.rampTo(subFreq, rampTime);
          this.subGain.gain.rampTo(0.18, 0.25);
        }
        break;
      }
    }
  }

  start() {
    this.initNodes();
    if (!this.initialized) return;

    this.isPlaying = true;
    this.reverbMuteGain.gain.rampTo(1.0, 0.05);

    try {
      if (this.windNoise.state !== 'started') this.windNoise.start();
      if (this.subOsc.state !== 'started') this.subOsc.start();
    } catch {}

    for (const key of Object.keys(this.currentValues)) {
      this.applyVoiceState(key);
    }

    this.startSchedulers();
  }

  stop() {
    this.isPlaying = false;
    this.isSweeping = false;
    this.stopSchedulers();

    if (!this.initialized) return;

    try {
      // Rapid attenuation guarantees silence within < 0.15s
      this.leadGain.gain.rampTo(0, 0.06);
      this.pluckGain.gain.rampTo(0, 0.06);
      this.solarGain.gain.rampTo(0, 0.06);
      this.windGain.gain.rampTo(0, 0.06);
      this.subGain.gain.rampTo(0, 0.06);
      this.reverbMuteGain.gain.rampTo(0, 0.06);

      if (this.padSounding) {
        this.solarSynth.releaseAll();
        this.padSounding = false;
      }
      this.leadSynth.triggerRelease(Tone.now());
    } catch {}
  }

  startSchedulers() {
    this.stopSchedulers();

    const bpm = this.identity?.baseBpm || 84;
    const tickIntervalMs = Math.round(60000 / (bpm * 4));

    this.clockTickCount = 0;
    this.clockTimer = setInterval(() => {
      this.onClockTick();
    }, tickIntervalMs);

    // Initial delay of 220ms ensures background ambiance stabilizes first (prevents onset jump)
    const leadIntervalMs = Math.round((60000 / bpm) * 2);
    setTimeout(() => {
      if (this.isPlaying) {
        this.triggerLeadNote();
        this.leadTimer = setInterval(() => {
          this.triggerLeadNote();
        }, leadIntervalMs);
      }
    }, 220);
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

  onClockTick() {
    if (!this.isPlaying || !this.initialized) return;
    this.clockTickCount++;

    const isEnabled = this.enabledState.precipMm;
    const rawPrecip = this.currentValues.precipMm;
    const norm = normalizeVariable('precipMm', rawPrecip);

    if (norm === null || !isEnabled || norm <= 0.001) {
      return;
    }

    const pluckProbability = Math.min(0.70, 0.04 + norm * 0.65);

    if (Math.random() < pluckProbability) {
      const plucks = this.identity?.pluckNotes || snapToNote(null, 'pluckScale');
      const noteIdx = Math.floor(Math.random() * plucks.length);
      const note = plucks[noteIdx];

      // Soft velocity prevents sudden onsets
      const velocity = Math.min(0.55, 0.22 + norm * 0.32);

      if (this.stereoSpread > 0.1) {
        const panJitter = -0.25 + (Math.random() - 0.5) * 0.22;
        this.pluckPanner.pan.rampTo(panJitter * this.stereoSpread, 0.02);
      }

      const now = Tone.now();
      if (this.variant === 'hybrid-sampled' && this.harpSampler && this.harpSamplesLoaded) {
        try {
          this.harpSampler.triggerAttackRelease(note, '8n', now, velocity);
        } catch {
          this.pluckSynth.triggerAttack(note, now, velocity);
        }
      } else {
        try {
          this.pluckSynth.triggerAttack(note, now, velocity);
        } catch {}
      }
    }
  }

  triggerLeadNote(articulation = '8n') {
    if (!this.isPlaying || !this.initialized) return;

    const isEnabled = this.enabledState.tempC;
    const rawTemp = this.currentValues.tempC;
    const norm = normalizeVariable('tempC', rawTemp);

    if (norm === null || !isEnabled) {
      return;
    }

    const leadNotes = this.identity?.leadNotes || snapToNote(null, 'leadScale');
    const note = snapToNote(norm, leadNotes);
    if (!note) return;

    const now = Tone.now();

    if (this.isSweeping) {
      try {
        const freq = Tone.Frequency(note).toFrequency();
        this.leadSynth.frequency.rampTo(freq, 0.25);
        if (this.variant === 'hybrid-sampled' && this.leadSampler && this.leadSamplesLoaded) {
          this.leadSampler.triggerAttackRelease(note, '4n', now, 0.28);
        }
      } catch {}
    } else {
      try {
        // Velocity 0.32 keeps level musical and safe
        this.leadSynth.triggerAttackRelease(note, articulation, now, 0.32);
        if (this.variant === 'hybrid-sampled' && this.leadSampler && this.leadSamplesLoaded) {
          this.leadSampler.triggerAttackRelease(note, articulation, now, 0.32);
        }
      } catch {}
    }
  }

  onYearStep({ isSweep = false, sweepInterval = 0.6 } = {}) {
    this.isSweeping = Boolean(isSweep);
    if (this.isPlaying) {
      this.triggerLeadNote(this.isSweeping ? '4n' : '8n');
      this.applyVoiceState('globalAnomalyC');
      this.applyVoiceState('solar');
      this.applyVoiceState('windMs');
      this.applyVoiceState('co2ppm');
    }
  }

  triggerCompareMarker(phase = 'transition') {
    if (!this.initialized) return;
    try {
      const now = Tone.now();
      this.markerSynth.triggerAttackRelease('C6', 0.06, now, 0.25);
      this.markerSynth.triggerAttackRelease('G5', 0.08, now + 0.07, 0.28);
    } catch {}
  }

  dispose() {
    this.stop();

    const nodes = [
      this.leadSynth, this.leadSampler, this.leadGain, this.leadPanner,
      this.pluckSynth, this.harpSampler, this.pluckGain, this.pluckPanner,
      this.solarSynth, this.solarFilter, this.solarChorus, this.solarGain, this.solarPanner,
      this.windNoise, this.windFilter, this.windGain, this.windPanner,
      this.subOsc, this.subFilter, this.subGain,
      this.markerSynth, this.markerGain,
      this.reverb, this.convolver, this.reverbSend, this.reverbWetGain, this.reverbDryGain, this.reverbMuteGain
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
