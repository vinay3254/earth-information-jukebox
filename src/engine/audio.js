/**
 * Earth Information Jukebox — Audio Engine & Master Bus
 *
 * Provides:
 * - initAudio(): Initializes Web Audio and Tone.js on user gesture
 * - audio.master: Master audio bus connected to a gentle limiter
 * - audio.setVolume(0..1): Logarithmic volume control
 * - audio.mute(bool): Master mute toggle
 * - audio.scale(name): Snap-to-scale musical note tables
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let masterNode = null;
let limiterNode = null;
let currentVolume = 0.85;
let isMuted = false;
let audioStarted = false;

/**
 * Scale definitions spanning musical octaves.
 * Snap all data readings to these scales to guarantee melodic, harmonious sonification.
 */
const SCALES = {
  // Major Pentatonic (bright, open, cosmic starlight)
  pentatonic: [
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6', 'G6', 'A6'
  ],
  majorPentatonic: [
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6', 'G6', 'A6'
  ],

  // Minor Pentatonic (dramatic, electric, percussion snaps)
  minorPentatonic: [
    'A1', 'C2', 'D2', 'E2', 'G2',
    'A2', 'C3', 'D3', 'E3', 'G3',
    'A3', 'C4', 'D4', 'E4', 'G4',
    'A4', 'C5', 'D5', 'E5', 'G5',
    'A5', 'C6', 'D6', 'E6', 'G6'
  ],
  lightning: [
    'A1', 'C2', 'D2', 'E2', 'G2',
    'A2', 'C3', 'D3', 'E3', 'G3',
    'A3', 'C4', 'D4', 'E4', 'G4',
    'A4', 'C5', 'D5', 'E5', 'G5'
  ],

  // Dorian mode (oceanic, deep maritime swells, floating currents)
  ocean: [
    'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3',
    'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
    'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
    'D5', 'E5', 'F5', 'G5', 'A5'
  ],
  dorian: [
    'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3',
    'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
    'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
    'D5', 'E5', 'F5', 'G5', 'A5'
  ],

  // Aerosols Lydian / Pentatonic (airy, atmospheric, layered)
  aerosols: [
    'F2', 'G2', 'A2', 'C3', 'D3',
    'F3', 'G3', 'A3', 'C4', 'D4',
    'F4', 'G4', 'A4', 'C5', 'D5',
    'F5', 'G5', 'A5', 'C6', 'D6'
  ],

  // Major / Ionian
  major: [
    'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'
  ],

  // Minor / Aeolian
  minor: [
    'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3',
    'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4',
    'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'
  ]
};

/**
 * Ensure master volume and limiter nodes exist and are wired.
 */
function ensureMaster() {
  if (!masterNode && typeof window !== 'undefined') {
    // Gentle limiter on master to prevent distortion and clipping
    limiterNode = new Tone.Limiter(-1);
    limiterNode.toDestination();

    // Master volume control node
    masterNode = new Tone.Volume(Tone.gainToDb(currentVolume));
    masterNode.connect(limiterNode);
    masterNode.mute = isMuted;
  }
  return masterNode;
}

/**
 * Initialize Web Audio and start Tone.js.
 * Must be invoked from a user gesture (e.g. Play button or keypress).
 */
export async function initAudio() {
  if (!audioStarted) {
    await Tone.start();
    audioStarted = true;
  }
  ensureMaster();
  const ctx = Tone.getContext();
  if (ctx && ctx.state !== 'running') {
    await ctx.resume();
  }
  return true;
}

/**
 * Audio facade conforming to specification contract.
 */
export const audio = {
  /**
   * Master bus destination node for track instruments.
   */
  get master() {
    return ensureMaster();
  },

  /**
   * Set master volume level (0..1).
   * @param {number} val
   */
  setVolume(val) {
    currentVolume = Math.max(0, Math.min(1, Number(val) || 0));
    if (masterNode) {
      if (currentVolume <= 0.001) {
        masterNode.volume.value = -Infinity;
      } else {
        masterNode.volume.rampTo(Tone.gainToDb(currentVolume), 0.05);
      }
    }
  },

  /**
   * Mute or unmute master output.
   * @param {boolean} shouldMute
   */
  mute(shouldMute) {
    isMuted = Boolean(shouldMute);
    if (masterNode) {
      masterNode.mute = isMuted;
    }
    if (typeof Tone.getDestination === 'function') {
      Tone.getDestination().mute = isMuted;
    }
  },

  /**
   * Returns an array of note names in pitch order for a given scale name.
   * @param {string} name - e.g. 'pentatonic', 'ocean', 'lightning', 'aerosols', 'major', 'minor'
   * @returns {string[]}
   */
  scale(name) {
    if (name && SCALES[name]) {
      return [...SCALES[name]];
    }
    return [...SCALES.pentatonic];
  }
};

/**
 * Helper to snap a normalized value [0..1] to a note in the given scale.
 * @param {number} normVal - 0..1
 * @param {string} scaleName - scale identifier
 * @returns {string} note name (e.g. 'C4')
 */
export function snapToScale(normVal, scaleName = 'pentatonic') {
  const notes = audio.scale(scaleName);
  const clamped = Math.max(0, Math.min(0.999, normVal));
  const idx = Math.floor(clamped * notes.length);
  return notes[idx];
}
