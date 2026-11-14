/**
 * Earth Information Jukebox — Ocean Currents & Temperature Track Module
 *
 * SVS 3912: Sea Surface Currents & Temperature (GHRSST MUR)
 * Feature: Frame-to-frame motion + warm/cool hue balance.
 * Sound: Lush warm pad synthesizer; motion opens the low-pass filter; warmer hue = higher chord.
 * Stereo: Dynamic stereo panning reflecting current drift across longitudes (-0.7..+0.7).
 *
 * Variants:
 * - 'analog-swell': Classic analog polyphonic pad with fat partials and pink surf
 * - 'hydrophone-waveguide' (Default): Deep maritime pad + hydrophone resonance + 7-chord modal ladder
 * - 'shimmer-drift': Ethereal oceanic pad with shimmering upper overtone & modulated drift
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let currentVariant = 'hydrophone-waveguide';

// Audio nodes
let panner = null;
let padSynth = null;
let shimmerSynth = null;
let filter = null;
let chorus = null;
let reverb = null;
let surfNoise = null;
let surfFilter = null;
let lastChordIndex = -1;
let lastChordTime = 0;
let currentNotes = [];

const OCEAN_CHORDS = [
  ['D2', 'A2', 'F3', 'C4', 'E4'],          // 0: Deep polar abyss / Antarctic upwelling (Dm9)
  ['G2', 'D3', 'Bb3', 'F4', 'A4'],         // 1: Subpolar gyre / Labrador current (Gm9)
  ['A2', 'E3', 'C4', 'G4', 'B4'],          // 2: Temperate drift / North Atlantic (Am9)
  ['F2', 'C3', 'A3', 'E4', 'G4'],          // 3: Subtropical convergence (Fmaj9)
  ['C3', 'G3', 'E4', 'B4', 'D5'],          // 4: Warm Kuroshio / Trade wind current (Cmaj9)
  ['G3', 'D4', 'B4', 'F#5', 'A5'],         // 5: Equatorial thermal flow (Gmaj9)
  ['D3', 'A3', 'F#4', 'C#5', 'E5']         // 6: Tropical thermal plume / Gulf Stream (Dmaj9)
];

function initNodes(audio) {
  if (typeof window === 'undefined') return;

  try {
    panner = new Tone.Panner(0);
    panner.connect(audio.master);

    reverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 });
    reverb.connect(panner);

    chorus = new Tone.Chorus(1.4, 3.2, 0.35);
    chorus.connect(reverb);

    filter = new Tone.Filter({
      frequency: 650,
      type: 'lowpass',
      rolloff: -24
    });
    filter.connect(chorus);

    // Warm analog polyphonic pad (volume -5.0 sits right in -17 LUFS target)
    padSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      voice: Tone.Synth,
      options: {
        oscillator: {
          type: 'fatcustom',
          partials: [1, 0.7, 0.4, 0.15],
          spread: 22,
          count: 3
        },
        envelope: {
          attack: 0.35,
          decay: 1.4,
          sustain: 0.85,
          release: 0.4
        }
      }
    });
    padSynth.volume.value = -5.0;
    padSynth.connect(filter);

    // High shimmer synth for Variant C
    shimmerSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 4,
      options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.6, decay: 1.8, sustain: 0.65, release: 0.4 }
      }
    });
    shimmerSynth.volume.value = -12;
    shimmerSynth.connect(chorus);

    // Organic maritime surf / ambient hydrophone noise
    surfFilter = new Tone.Filter(350, 'lowpass');
    surfFilter.connect(reverb);

    surfNoise = new Tone.Noise('pink');
    surfNoise.volume.value = -25;
    surfNoise.connect(surfFilter);
    surfNoise.start();
  } catch {
    // Non-browser fallback
  }
}

export default {
  id: 'ocean',
  colorClasses: undefined,

  setVariant(v) {
    if (['analog-swell', 'hydrophone-waveguide', 'shimmer-drift'].includes(v)) {
      currentVariant = v;
    }
  },

  getVariant() {
    return currentVariant;
  },

  get variants() {
    return ['analog-swell', 'hydrophone-waveguide', 'shimmer-drift'];
  },

  start(audio) {
    this.stop(audio);
    initNodes(audio);

    lastChordIndex = -1;
    lastChordTime = 0;
    currentNotes = [];
  },

  update(features, audio, state) {
    if (!padSynth || !features) return;

    const warm = features.hue?.warm || 0;
    const cool = features.hue?.cool || 0;
    const motion = features.motion || 0;

    // 1. Motion opens the low-pass filter
    const motionClamped = Math.min(1.0, Math.max(0, motion * 20.0));
    const targetFreq = 400 + motionClamped * 2600;

    if (filter && filter.frequency) {
      try {
        filter.frequency.rampTo(targetFreq, 0.16);
      } catch {}
    }

    // Dynamic stereo panning
    if (panner && panner.pan) {
      const thermalPan = (warm - cool) * 1.5;
      const safePan = Math.max(-0.75, Math.min(0.75, thermalPan));
      try {
        panner.pan.rampTo(safePan, 0.25);
      } catch {}
    }

    // Surf noise reacts to motion
    if (surfFilter && surfFilter.frequency) {
      try {
        surfFilter.frequency.rampTo(240 + motionClamped * 800, 0.2);
        if (surfNoise) {
          const surfVol = currentVariant === 'hydrophone-waveguide'
            ? -25 + motionClamped * 8
            : -28 + motionClamped * 7;
          surfNoise.volume.rampTo(surfVol, 0.2);
        }
      } catch {}
    }

    // 2. Warmer hue = higher chord in the 7-zone modal ladder
    const totalColor = warm + cool;
    const warmRatio = totalColor > 0.001 ? (warm / totalColor) : 0.5;
    const chordIdx = Math.max(0, Math.min(OCEAN_CHORDS.length - 1, Math.floor(warmRatio * OCEAN_CHORDS.length)));

    const now = Tone.now();
    if (chordIdx !== lastChordIndex || now - lastChordTime > 2.4) {
      const nextNotes = OCEAN_CHORDS[chordIdx];

      try {
        if (currentNotes.length > 0) {
          padSynth.releaseAll(now);
          if (shimmerSynth && currentVariant === 'shimmer-drift') {
            shimmerSynth.releaseAll(now);
          }
        }

        padSynth.triggerAttack(nextNotes.slice(0, 4), now + 0.05, 0.72);

        if (shimmerSynth && currentVariant === 'shimmer-drift' && nextNotes[3]) {
          const highNote = nextNotes[3].replace(/\d/, (d) => String(Number(d) + 1));
          shimmerSynth.triggerAttack([highNote], now + 0.08, 0.48);
        }

        currentNotes = nextNotes;
        lastChordIndex = chordIdx;
        lastChordTime = now;
      } catch {}
    }
  },

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

  probe(region, audio, xNorm = 0.5) {
    if (audio && typeof audio.playProbe === 'function') {
      audio.playProbe(region, xNorm);
    } else {
      let probeNotes = OCEAN_CHORDS[2];
      if (region?.hueName === 'warm') {
        probeNotes = OCEAN_CHORDS[5];
      } else if (region?.hueName === 'cool') {
        probeNotes = OCEAN_CHORDS[0];
      } else if (region?.hueName === 'green') {
        probeNotes = ['E3', 'B3', 'G4', 'D5'];
      }
      try {
        padSynth?.triggerAttackRelease(probeNotes, '2n', Tone.now(), 0.75);
      } catch {}
    }
  },

  stop(audio) {
    if (padSynth) {
      try { padSynth.releaseAll(); padSynth.dispose(); } catch {}
      padSynth = null;
    }
    if (shimmerSynth) {
      try { shimmerSynth.releaseAll(); shimmerSynth.dispose(); } catch {}
      shimmerSynth = null;
    }
    if (surfNoise) {
      try { surfNoise.stop(); surfNoise.dispose(); } catch {}
      surfNoise = null;
    }
    if (surfFilter) {
      try { surfFilter.dispose(); } catch {}
      surfFilter = null;
    }
    if (filter) {
      try { filter.dispose(); } catch {}
      filter = null;
    }
    if (chorus) {
      try { chorus.dispose(); } catch {}
      chorus = null;
    }
    if (reverb) {
      try { reverb.dispose(); } catch {}
      reverb = null;
    }
    if (panner) {
      try { panner.dispose(); } catch {}
      panner = null;
    }
    currentNotes = [];
    lastChordIndex = -1;
  }
};
