// Sun Drone: deep solar sonification based on helioseismic oscillations (~3.3 mHz p-modes)
// and convective granulation (matching the solar shader time scale in solarSystem.js).
import * as Tone from 'tone';
import { SUN_AUDIO_DATA } from './voiceData.js';

/**
 * Creates the Sun drone audio generator.
 * @param {object} [options]
 * @param {Tone.ToneAudioNode} [options.destination]
 * @returns {object} Sun drone controller
 */
export function createSunDrone({ destination = Tone.getDestination() } = {}) {
  let isStarted = false;
  let isDisposed = false;
  let currentVolume = 0.7;

  // Master output gain for the Sun drone
  const outGain = new Tone.Gain(0);
  const panner = new Tone.Panner(0);

  // Warm low-pass filter to keep the drone deep and non-intrusive
  const filter = new Tone.Filter({
    frequency: SUN_AUDIO_DATA.filterCutoff,
    type: 'lowpass',
    rolloff: -24,
    Q: SUN_AUDIO_DATA.filterQ
  });

  // Granulation LFO: 0.06 Hz slow convection cycle
  const granulationLfo = new Tone.LFO({
    frequency: SUN_AUDIO_DATA.granulationRate,
    min: SUN_AUDIO_DATA.filterCutoff * 0.8,
    max: SUN_AUDIO_DATA.filterCutoff * 1.25
  });

  // Oscillators:
  // 1. C2 Fundamental (65.41 Hz)
  const oscC2 = new Tone.Oscillator({
    frequency: SUN_AUDIO_DATA.fundamentalFreq,
    type: 'triangle',
    volume: -12
  });

  // 2. C1 Sub-bass (32.70 Hz)
  const oscC1 = new Tone.Oscillator({
    frequency: SUN_AUDIO_DATA.subFreq,
    type: 'sine',
    volume: -15
  });

  // 3. G2 Warm fifth overtone (98.00 Hz)
  const oscG2 = new Tone.Oscillator({
    frequency: SUN_AUDIO_DATA.overtoneFreq,
    type: 'sine',
    volume: -20
  });

  // Connect routing
  granulationLfo.connect(filter.frequency);
  oscC2.connect(filter);
  oscC1.connect(filter);
  oscG2.connect(filter);
  filter.connect(panner);
  panner.connect(outGain);

  if (destination) {
    outGain.connect(destination);
  }

  function start() {
    if (isDisposed || isStarted) return;
    try {
      oscC2.start();
      oscC1.start();
      oscG2.start();
      granulationLfo.start();
      isStarted = true;
    } catch {
      // AudioContext may not be active yet
    }
  }

  return {
    get isStarted() { return isStarted; },

    start,

    /**
     * Fade in the Sun drone.
     * @param {number} [targetLevel=0.35] target amplitude 0..1
     * @param {number} [rampTime=0.4] seconds
     */
    fadeIn(targetLevel = 0.35, rampTime = 0.4) {
      start();
      if (isDisposed) return;
      const target = Math.max(0, Math.min(1, targetLevel * currentVolume * SUN_AUDIO_DATA.balanceGain));
      outGain.gain.rampTo(target, rampTime);
    },

    /**
     * Fade out the Sun drone.
     * @param {number} [rampTime=0.3] seconds (<=0.5s requirement)
     */
    fadeOut(rampTime = 0.3) {
      if (isDisposed) return;
      outGain.gain.rampTo(0, rampTime);
    },

    /**
     * Set master volume level for Sun drone.
     * @param {number} v 0..1
     */
    setVolume(v) {
      currentVolume = Math.max(0, Math.min(1, Number(v) || 0));
    },

    /**
     * Set stereo pan (-1 to 1).
     * @param {number} p
     */
    setPan(p) {
      if (isDisposed) return;
      const clamped = Math.max(-1, Math.min(1, Number(p) || 0));
      panner.pan.rampTo(clamped, 0.05);
    },

    connect(node) {
      outGain.connect(node);
      return this;
    },

    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        outGain.gain.rampTo(0, 0.05);
        oscC2.stop();
        oscC1.stop();
        oscG2.stop();
        granulationLfo.stop();

        oscC2.dispose();
        oscC1.dispose();
        oscG2.dispose();
        granulationLfo.dispose();
        filter.dispose();
        panner.dispose();
        outGain.dispose();
      } catch {
        // Safe disposal
      }
    }
  };
}
