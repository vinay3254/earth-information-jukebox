// Timbre engine designs for planet voices sonification.
// Compares 3 distinct timbre architectures derived from NASA fact-sheet data:
// Timbre 1: Subtractive Analog (Saw/Tri + 24dB Moog-style filter)
// Timbre 2: Additive Harmonic Choirs (Pure sine harmonic series)
// Timbre 3: Hybrid Spectral FM + Planetary Textures (Saturn Ring Shimmer, Neptune Wind, Venus Greenhouse)
import * as Tone from 'tone';

// ============================================================================
// Timbre 1: Subtractive Analog Cosmodrome
// ============================================================================
export function createSubtractiveVoice(data, destination) {
  let isStarted = false;
  let isDisposed = false;

  const outGain = new Tone.Gain(0);
  const panner = new Tone.Panner(0);

  const filter = new Tone.Filter({
    frequency: data.filterCutoff,
    type: 'lowpass',
    rolloff: -24,
    Q: data.filterQ
  });

  const oscSaw = new Tone.Oscillator({
    frequency: data.fundamentalFreq,
    type: 'sawtooth',
    volume: -2
  });

  const oscTri = new Tone.Oscillator({
    frequency: data.harmonicFreq,
    type: 'triangle',
    detune: 2,
    volume: -6
  });

  const tremoloLfo = new Tone.LFO({
    frequency: data.tremoloRate,
    min: 0.65,
    max: 1.0
  });

  const tremoloGain = new Tone.Gain(1);
  tremoloLfo.connect(tremoloGain.gain);

  oscSaw.connect(filter);
  oscTri.connect(filter);
  filter.connect(tremoloGain);
  tremoloGain.connect(panner);
  panner.connect(outGain);

  if (destination) outGain.connect(destination);

  return {
    start() {
      if (isStarted || isDisposed) return;
      try {
        oscSaw.start();
        oscTri.start();
        tremoloLfo.start();
        isStarted = true;
      } catch {}
    },
    fadeIn(targetLevel, rampTime = 0.25) {
      this.start();
      if (isDisposed) return;
      const target = Math.max(0, Math.min(1, targetLevel * data.balanceGain));
      outGain.gain.rampTo(target, rampTime);
    },
    fadeOut(rampTime = 0.22) {
      if (isDisposed) return;
      outGain.gain.rampTo(0, Math.min(rampTime, 0.35));
    },
    setPan(p) {
      if (isDisposed) return;
      panner.pan.rampTo(Math.max(-1, Math.min(1, Number(p) || 0)), 0.05);
    },
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        outGain.gain.rampTo(0, 0.04);
        oscSaw.stop();
        oscTri.stop();
        tremoloLfo.stop();

        oscSaw.dispose();
        oscTri.dispose();
        tremoloLfo.dispose();
        tremoloGain.dispose();
        filter.dispose();
        panner.dispose();
        outGain.dispose();
      } catch {}
    }
  };
}

// ============================================================================
// Timbre 2: Additive Celestial Sine Choirs
// ============================================================================
export function createAdditiveVoice(data, destination) {
  let isStarted = false;
  let isDisposed = false;

  const outGain = new Tone.Gain(0);
  const panner = new Tone.Panner(0);

  const tNorm = Math.max(0, Math.min(1, (data.tempC + 200) / 664));

  const oscFund = new Tone.Oscillator({
    frequency: data.fundamentalFreq,
    type: 'sine',
    volume: 0
  });

  const oscHarm1 = new Tone.Oscillator({
    frequency: data.harmonicFreq,
    type: 'sine',
    volume: -8 + tNorm * 6
  });

  const oscHarm2 = new Tone.Oscillator({
    frequency: data.fundamentalFreq * 3,
    type: 'sine',
    volume: -18 + tNorm * 10
  });

  const tremoloLfo = new Tone.LFO({
    frequency: data.tremoloRate,
    min: 0.6,
    max: 1.0
  });

  const tremoloGain = new Tone.Gain(1);
  tremoloLfo.connect(tremoloGain.gain);

  oscFund.connect(tremoloGain);
  oscHarm1.connect(tremoloGain);
  oscHarm2.connect(tremoloGain);
  tremoloGain.connect(panner);
  panner.connect(outGain);

  if (destination) outGain.connect(destination);

  return {
    start() {
      if (isStarted || isDisposed) return;
      try {
        oscFund.start();
        oscHarm1.start();
        oscHarm2.start();
        tremoloLfo.start();
        isStarted = true;
      } catch {}
    },
    fadeIn(targetLevel, rampTime = 0.25) {
      this.start();
      if (isDisposed) return;
      const target = Math.max(0, Math.min(1, targetLevel * data.balanceGain));
      outGain.gain.rampTo(target, rampTime);
    },
    fadeOut(rampTime = 0.22) {
      if (isDisposed) return;
      outGain.gain.rampTo(0, Math.min(rampTime, 0.35));
    },
    setPan(p) {
      if (isDisposed) return;
      panner.pan.rampTo(Math.max(-1, Math.min(1, Number(p) || 0)), 0.05);
    },
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        outGain.gain.rampTo(0, 0.04);
        oscFund.stop();
        oscHarm1.stop();
        oscHarm2.stop();
        tremoloLfo.stop();

        oscFund.dispose();
        oscHarm1.dispose();
        oscHarm2.dispose();
        tremoloLfo.dispose();
        tremoloGain.dispose();
        panner.dispose();
        outGain.dispose();
      } catch {}
    }
  };
}

// ============================================================================
// Timbre 3: Hybrid Spectral FM + Planetary Fact-Sheet Textures (Winner/Signature)
// ============================================================================
export function createHybridVoice(data, destination) {
  let isStarted = false;
  let isDisposed = false;

  const outGain = new Tone.Gain(0);
  const panner = new Tone.Panner(0);

  // Normalized temperature drives FM brightness / modulation index
  const tNorm = Math.max(0, Math.min(1, (data.tempC + 200) / 664));
  const modIndex = Number((0.6 + 3.4 * Math.pow(tNorm, 0.85)).toFixed(2));

  // Core FM Synth: warm fundamental carrier with data-driven modulation index
  const fmSynth = new Tone.FMSynth({
    harmonicity: data.kind === 'rock' ? 2.0 : 1.0,
    modulationIndex: modIndex,
    oscillator: { type: data.fundamentalFreq < 120 ? 'sine' : 'triangle' },
    envelope: { attack: 0.28, decay: 0.3, sustain: 1.0, release: 0.25 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.32, decay: 0.4, sustain: 0.9, release: 0.25 }
  });
  // Calibrated voice volume for ~ -18 dBFS running level
  fmSynth.volume.value = 5;

  // Temperature-derived lowpass filter
  const filter = new Tone.Filter({
    frequency: data.filterCutoff,
    type: 'lowpass',
    rolloff: -12,
    Q: data.filterQ
  });

  // Day-length tremolo LFO: modulates filter cutoff and amplitude
  const tremoloLfo = new Tone.LFO({
    frequency: data.tremoloRate,
    min: 0.65,
    max: 1.0
  });
  const tremoloGain = new Tone.Gain(1);
  tremoloLfo.connect(tremoloGain.gain);

  fmSynth.connect(filter);
  filter.connect(tremoloGain);
  tremoloGain.connect(panner);

  // --------------------------------------------------------------------------
  // Planetary Fact-Sheet Specific Layers:
  // --------------------------------------------------------------------------
  const extraNodes = [];

  // (a) Saturn Ring Shimmer:
  // Rings are ice and rock; shimmering high crystalline resonance
  let ringNoise = null;
  let ringFilter = null;
  let ringOsc = null;
  let ringLfo = null;
  let ringGain = null;

  if (data.hasRings) {
    ringGain = new Tone.Gain(0.22);
    ringFilter = new Tone.Filter({
      frequency: 6200,
      type: 'bandpass',
      Q: 4.8
    });
    ringNoise = new Tone.Noise('pink');
    ringOsc = new Tone.Oscillator({
      frequency: 2349.32, // D7 celestial shimmer
      type: 'sine',
      volume: -16
    });
    ringLfo = new Tone.LFO({
      frequency: 8.4, // Micro-shimmer
      min: 0.45,
      max: 1.0
    });
    const ringSubGain = new Tone.Gain(1);
    ringLfo.connect(ringSubGain.gain);

    ringNoise.connect(ringFilter);
    ringOsc.connect(ringFilter);
    ringFilter.connect(ringSubGain);
    ringSubGain.connect(ringGain);
    ringGain.connect(panner);

    extraNodes.push(ringNoise, ringFilter, ringOsc, ringLfo, ringSubGain, ringGain);
  }

  // (b) Neptune 2,000 km/h Supersonic Wind Bed:
  let windNoise = null;
  let windFilter = null;
  let windLfo = null;
  let windGain = null;

  if (data.isWindy) {
    windGain = new Tone.Gain(0.18);
    windFilter = new Tone.Filter({
      frequency: 850,
      type: 'bandpass',
      Q: 2.2
    });
    windNoise = new Tone.Noise('pink');
    windLfo = new Tone.LFO({
      frequency: 0.22, // Slow howling gust
      min: 650,
      max: 1100
    });
    windLfo.connect(windFilter.frequency);
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(panner);

    extraNodes.push(windNoise, windFilter, windLfo, windGain);
  }

  // (c) Venus 93-Bar Supercritical Greenhouse Swell:
  let venusSubOsc = null;
  let venusGain = null;

  if (data.isSupercritical) {
    venusGain = new Tone.Gain(0.20);
    venusSubOsc = new Tone.Oscillator({
      frequency: data.fundamentalFreq * 1.5, // G4 fifth shimmer
      type: 'sine',
      detune: 4,
      volume: -10
    });
    venusSubOsc.connect(venusGain);
    venusGain.connect(panner);
    extraNodes.push(venusSubOsc, venusGain);
  }

  panner.connect(outGain);
  if (destination) outGain.connect(destination);

  return {
    start() {
      if (isStarted || isDisposed) return;
      try {
        tremoloLfo.start();
        fmSynth.triggerAttack(data.fundamentalNote, Tone.now(), 0.75);

        if (ringNoise) ringNoise.start();
        if (ringOsc) ringOsc.start();
        if (ringLfo) ringLfo.start();

        if (windNoise) windNoise.start();
        if (windLfo) windLfo.start();

        if (venusSubOsc) venusSubOsc.start();

        isStarted = true;
      } catch {}
    },
    fadeIn(targetLevel, rampTime = 0.25) {
      this.start();
      if (isDisposed) return;
      const target = Math.max(0, Math.min(1, targetLevel * data.balanceGain));
      outGain.gain.rampTo(target, rampTime);
    },
    fadeOut(rampTime = 0.22) {
      if (isDisposed) return;
      outGain.gain.rampTo(0, Math.min(rampTime, 0.35));
    },
    setPan(p) {
      if (isDisposed) return;
      panner.pan.rampTo(Math.max(-1, Math.min(1, Number(p) || 0)), 0.05);
    },
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        outGain.gain.rampTo(0, 0.04);
        tremoloLfo.stop();
        fmSynth.triggerRelease();

        extraNodes.forEach((node) => {
          try {
            if (typeof node.stop === 'function') node.stop();
            if (typeof node.dispose === 'function') node.dispose();
          } catch {}
        });

        tremoloLfo.dispose();
        tremoloGain.dispose();
        filter.dispose();
        fmSynth.dispose();
        panner.dispose();
        outGain.dispose();
      } catch {}
    }
  };
}

export const TIMBRE_FACTORIES = {
  subtractive: createSubtractiveVoice,
  additive: createAdditiveVoice,
  hybrid: createHybridVoice
};
