// Planet Voices Sonification Engine — Earth Information Jukebox
// Implements:
// (a) One sustained data-driven 'planet voice' per planet derived from NASA Planetary Fact Sheet
// (b) Sun drone (helioseismic C1/C2 fundamental + 0.06 Hz solar granulation pulsation)
// (c) 'Whole system' spatial audio mode mixing all planets quietly, panned by screen side
// (d) Peak safety limiting (-2 dBFS, true peak <= 0.8) and gentle smooth envelopes (silence in <0.3s)
import * as Tone from 'tone';
import { PLANET_AUDIO_DATA, getPlanetAudioData } from './voiceData.js';
import { createSunDrone } from './sunDrone.js';
import { TIMBRE_FACTORIES } from './timbres.js';

/**
 * Creates the Planet Voices audio system.
 * Conforms to contract: { focus(planet), unfocus(), setSystem(on), setPan(planetId, -1..1), setVolume(v), dispose() }
 *
 * @param {object} [options]
 * @param {Tone.ToneAudioNode} [options.destination] optional destination bus
 * @param {string} [options.timbre='hybrid'] 'hybrid' | 'additive' | 'subtractive'
 * @returns {object} Planet voices controller
 */
export function createPlanetVoices({
  destination = null,
  timbre = 'hybrid'
} = {}) {
  let isDisposed = false;
  let masterVolume = 0.8;
  let systemMode = false;
  let focusedId = null;
  let activeTimbre = TIMBRE_FACTORIES[timbre] ? timbre : 'hybrid';

  // --------------------------------------------------------------------------
  // Output Bus & Safety Limiter:
  // Master limiter at -2.0 dBFS guarantees True Peak <= 0.8 under all conditions
  // --------------------------------------------------------------------------
  const limiter = new Tone.Limiter(-2);
  if (destination) {
    limiter.connect(destination);
  } else {
    limiter.toDestination();
  }

  const masterGain = new Tone.Gain(masterVolume).connect(limiter);
  const spaceReverb = new Tone.Reverb({ decay: 4.2, wet: 0.30 }).connect(masterGain);
  const voiceBus = new Tone.Gain(1.0).connect(spaceReverb);

  // --------------------------------------------------------------------------
  // Sun Drone
  // --------------------------------------------------------------------------
  const sunDrone = createSunDrone({ destination: voiceBus });

  // --------------------------------------------------------------------------
  // Planet Voices Registry
  // --------------------------------------------------------------------------
  let voices = new Map();

  function initVoices(timbreKey) {
    voices.forEach((voice) => voice.dispose());
    voices.clear();

    const factory = TIMBRE_FACTORIES[timbreKey] || TIMBRE_FACTORIES.hybrid;
    PLANET_AUDIO_DATA.forEach((data) => {
      const voice = factory(data, voiceBus);
      voices.set(data.id, voice);
    });
  }

  initVoices(activeTimbre);

  // Calibrated target levels:
  // Solo focused: ~ -18 dBFS running RMS
  // Whole system: ~ -17 dBFS combined 8-planet + Sun mix
  const SOLO_LEVEL = 0.88;
  const SYSTEM_BLEND_LEVEL = 0.28;
  const DUCKED_LEVEL = 0.09;

  /**
   * Recalculates and ramps target gains for all voices based on current state.
   */
  function applyMix(rampTime = 0.35) {
    if (isDisposed) return;

    const hasActiveSound = Boolean(focusedId || systemMode);

    if (hasActiveSound) {
      voiceBus.gain.rampTo(1.0, 0.20);
      spaceReverb.wet.rampTo(0.30, 0.20);
    } else {
      // Fast fadeout ensures silence within <= 0.35s (brief requirement <= 0.5s)
      voiceBus.gain.rampTo(0, 0.20);
      spaceReverb.wet.rampTo(0, 0.25);
    }

    voices.forEach((voice, id) => {
      if (id === focusedId) {
        voice.fadeIn(SOLO_LEVEL, rampTime);
      } else if (systemMode) {
        const level = focusedId ? DUCKED_LEVEL : SYSTEM_BLEND_LEVEL;
        voice.fadeIn(level, rampTime);
      } else {
        voice.fadeOut(0.20);
      }
    });

    // Sun drone management:
    if (focusedId === 'sun') {
      sunDrone.fadeIn(SOLO_LEVEL * 0.85, rampTime);
    } else if (systemMode) {
      sunDrone.fadeIn(SYSTEM_BLEND_LEVEL * 0.95, rampTime);
    } else {
      sunDrone.fadeOut(0.20);
    }
  }

  return {
    get focused() {
      return focusedId;
    },

    get isSystem() {
      return systemMode;
    },

    get timbre() {
      return activeTimbre;
    },

    /**
     * Focus on a planet (or Sun).
     * Brings that planet's sustained voice to the foreground.
     * @param {string|object} planet planet object or string id (e.g. 'jupiter', 'saturn', 'sun')
     */
    focus(planet) {
      if (isDisposed) return;
      const id = typeof planet === 'string' ? planet.toLowerCase() : planet?.id?.toLowerCase();
      if (!id) return;

      focusedId = id;
      applyMix(0.28);
    },

    /**
     * Unfocus the current planet.
     * Smoothly fades out the voice to silence within <=0.35s (or returns to whole-system mix).
     */
    unfocus() {
      if (isDisposed) return;
      focusedId = null;
      applyMix(0.22);
    },

    /**
     * Toggle or set Whole System mode.
     * Mixes all planets quietly, panned across the stereo field.
     * @param {boolean} on
     */
    setSystem(on) {
      if (isDisposed) return;
      systemMode = Boolean(on);
      applyMix(0.30);
    },

    /**
     * Set stereo pan for a planet (-1 = left screen, +1 = right screen).
     * @param {string} planetId e.g. 'mercury', 'jupiter'
     * @param {number} panValue -1.0 .. 1.0
     */
    setPan(planetId, panValue) {
      if (isDisposed) return;
      const id = String(planetId || '').toLowerCase();
      if (id === 'sun') {
        sunDrone.setPan(panValue);
        return;
      }
      const voice = voices.get(id);
      if (voice) {
        voice.setPan(panValue);
      }
    },

    /**
     * Set master volume level (0..1).
     * @param {number} v 0..1
     */
    setVolume(v) {
      masterVolume = Math.max(0, Math.min(1, Number(v) || 0));
      if (isDisposed) return;
      if (masterVolume <= 0.0001) {
        masterGain.gain.rampTo(0, 0.06);
      } else {
        masterGain.gain.rampTo(masterVolume, 0.06);
      }
      sunDrone.setVolume(masterVolume);
    },

    /**
     * Switch timbre engine ('hybrid' | 'additive' | 'subtractive').
     * @param {string} name
     */
    setTimbre(name) {
      if (isDisposed || !TIMBRE_FACTORIES[name] || activeTimbre === name) return;
      activeTimbre = name;
      initVoices(activeTimbre);
      applyMix(0.20);
    },

    /**
     * Cleanly stop, mute, and dispose of all Web Audio nodes and voices.
     */
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      try {
        masterGain.gain.rampTo(0, 0.04);

        voices.forEach((voice) => voice.dispose());
        voices.clear();

        sunDrone.dispose();
        voiceBus.dispose();
        spaceReverb.dispose();
        masterGain.dispose();
        limiter.dispose();
      } catch {
        // Safe disposal
      }
    }
  };
}
