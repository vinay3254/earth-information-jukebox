/**
 * Earth Information Jukebox — Ocean Currents & Temperature Track Module
 *
 * SVS 3912: Sea Surface Currents & Temperature
 * Feature: Frame-to-frame motion + warm/cool hue balance.
 * Sound: Lush warm pad synthesizer; motion opens the low-pass filter; warmer hue = higher chord.
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let padSynth = null;
let filter = null;
let chorus = null;
let reverb = null;
let surfNoise = null;
let surfFilter = null;
let lastChordIndex = -1;
let lastChordTime = 0;
let currentNotes = [];

// Chords ordered from cold/polar depths to warm tropical currents
const OCEAN_CHORDS = [
  ['D2', 'A2', 'F3', 'C4'],          // Cold abyss / Polar upwelling (Dm7)
  ['G2', 'D3', 'Bb3', 'F4'],         // Deep cold subpolar current (Gm7)
  ['A2', 'E3', 'C4', 'G4'],          // Temperate mid-latitude drift (Am7)
  ['F2', 'C3', 'A3', 'E4'],          // Subtropical convergence (Fmaj7)
  ['C3', 'G3', 'E4', 'B4'],          // Warm equatorial flow (Cmaj7)
  ['G3', 'D4', 'B4', 'F#5', 'A5']    // Tropical thermal plume / Gulf Stream (Gmaj9)
];

export default {
  id: 'ocean',
  colorClasses: undefined,

  /**
   * Initialize and connect instruments.
   * @param {import('../audio.js').audio} audio
   */
  start(audio) {
    if (padSynth) this.stop(audio);

    try {
      reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 });
      reverb.connect(audio.master);

      chorus = new Tone.Chorus(1.5, 3.5, 0.4);
      chorus.connect(reverb);

      filter = new Tone.Filter({
        frequency: 450,
        type: 'lowpass',
        rolloff: -24
      });
      filter.connect(chorus);

      padSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'fatcustom', partials: [1, 0.6, 0.3, 0.1], spread: 20, count: 3 },
          envelope: {
            attack: 0.8,
            decay: 1.5,
            sustain: 0.85,
            release: 2.0
          }
        }
      });
      padSynth.volume.value = -6;
      padSynth.connect(filter);

      // Gentle ocean surf / wind texture
      surfFilter = new Tone.Filter(300, 'lowpass');
      surfFilter.connect(reverb);
      surfNoise = new Tone.Noise('pink');
      surfNoise.volume.value = -28;
      surfNoise.connect(surfFilter);
      surfNoise.start();
    } catch {
      // AudioContext may not be active in tests
    }

    lastChordIndex = -1;
    lastChordTime = 0;
    currentNotes = [];
  },

  /**
   * Called ~15 Hz while playing.
   * Modulates filter cutoff with motion and shifts chords with warm/cool ratio.
   *
   * @param {import('../features.js').FrameFeatures} features
   * @param {import('../audio.js').audio} audio
   * @param {{ scanX: number }} state
   */
  update(features, audio, state) {
    if (!padSynth || !features) return;

    const warm = features.hue?.warm || 0;
    const cool = features.hue?.cool || 0;
    const motion = features.motion || 0;

    // 1. Motion opens the low-pass filter
    // Satellite motion typically ranges 0.002 (calm) to ~0.08 (intense eddies)
    const motionClamped = Math.min(1.0, Math.max(0, motion * 20.0));
    const targetFreq = 280 + motionClamped * 3200;

    if (filter && filter.frequency) {
      try {
        filter.frequency.rampTo(targetFreq, 0.15);
      } catch {}
    }

    // Surf noise reacts to motion
    if (surfFilter && surfFilter.frequency) {
      try {
        surfFilter.frequency.rampTo(200 + motionClamped * 800, 0.2);
        if (surfNoise) {
          surfNoise.volume.rampTo(-32 + motionClamped * 14, 0.2);
        }
      } catch {}
    }

    // 2. Warmer hue = higher chord
    const totalColor = warm + cool;
    const warmRatio = totalColor > 0.001 ? (warm / totalColor) : 0.5;
    const chordIdx = Math.max(0, Math.min(OCEAN_CHORDS.length - 1, Math.floor(warmRatio * OCEAN_CHORDS.length)));

    const now = Tone.now();
    // Revoice chord when balance shifts or every 2.4s to maintain rolling swells
    if (chordIdx !== lastChordIndex || now - lastChordTime > 2.4) {
      const nextNotes = OCEAN_CHORDS[chordIdx];

      try {
        if (currentNotes.length > 0) {
          padSynth.releaseAll(now);
        }
        padSynth.triggerAttack(nextNotes, now + 0.1, 0.7);
        currentNotes = nextNotes;
        lastChordIndex = chordIdx;
        lastChordTime = now;
      } catch {}
    }
  },

  /**
   * Generates a concise screen-reader caption.
   * @param {import('../features.js').FrameFeatures} features
   * @returns {string}
   */
  describe(features) {
    const warm = features?.hue?.warm || 0;
    const cool = features?.hue?.cool || 0;
    const total = warm + cool;
    const warmRatio = total > 0.01 ? (warm / total) : 0.5;
    const motion = features?.motion || 0;

    let motionDesc = 'gentle laminar drift';
    if (motion > 0.04) {
      motionDesc = 'fast, energetic swirling vortex eddies';
    } else if (motion > 0.015) {
      motionDesc = 'steady undulating current streams';
    }

    let thermalDesc = 'temperate oceanic thermal gradient';
    if (warmRatio > 0.62) {
      thermalDesc = 'warm surface currents and thermal anomalies';
    } else if (warmRatio < 0.38) {
      thermalDesc = 'cool deep-water upwelling and subpolar gyres';
    }

    return `Sea surface dynamics: ${thermalDesc} with ${motionDesc}.`;
  },

  /**
   * Play sound for a probed region in explore mode.
   * @param {{ luma: number, hueName: string, motion: number }} region
   * @param {import('../audio.js').audio} audio
   */
  probe(region, audio) {
    if (!padSynth) this.start(audio);
    if (!padSynth) return;

    let probeNotes = OCEAN_CHORDS[2];
    if (region?.hueName === 'warm') {
      probeNotes = OCEAN_CHORDS[4];
    } else if (region?.hueName === 'cool') {
      probeNotes = OCEAN_CHORDS[0];
    } else if (region?.hueName === 'green') {
      probeNotes = ['E3', 'B3', 'G4', 'D5']; // Chlorophyll bloom
    }

    try {
      const cutoff = 300 + Math.min(1.0, (region?.motion || 0) * 20.0) * 3000;
      if (filter && filter.frequency) {
        filter.frequency.setValueAtTime(cutoff, Tone.now());
      }
      padSynth.triggerAttackRelease(probeNotes, '2n', Tone.now(), 0.75);
    } catch {}
  },

  /**
   * Release and dispose instruments.
   * @param {import('../audio.js').audio} audio
   */
  stop(audio) {
    if (padSynth) {
      try {
        padSynth.releaseAll();
        padSynth.dispose();
      } catch {}
      padSynth = null;
    }
    if (surfNoise) {
      try {
        surfNoise.stop();
        surfNoise.dispose();
      } catch {}
      surfNoise = null;
    }
    if (surfFilter) {
      try {
        surfFilter.dispose();
      } catch {}
      surfFilter = null;
    }
    if (filter) {
      try {
        filter.dispose();
      } catch {}
      filter = null;
    }
    if (chorus) {
      try {
        chorus.dispose();
      } catch {}
      chorus = null;
    }
    if (reverb) {
      try {
        reverb.dispose();
      } catch {}
      reverb = null;
    }
    currentNotes = [];
    lastChordIndex = -1;
  }
};
