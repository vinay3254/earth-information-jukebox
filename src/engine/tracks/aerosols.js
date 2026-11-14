/**
 * Earth Information Jukebox — GEOS Aerosols Track Module
 *
 * SVS 5669: GEOS Aerosols
 * Feature: Coverage of color classes (dust / smoke / sea salt / sulfate).
 * Sound: One instrument per class; coverage = volume.
 *
 * Color classes defined per NASA GEOS visualization:
 * - sea_salt: Blue (ocean spray, tropical cyclones)
 * - dust: Pink/Magenta/Tan (Saharan & desert dust storms)
 * - smoke: Orange/Red (wildfires & biomass burning)
 * - sulfate: Green (volcanic emissions & industrial sulfates)
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

const COLOR_CLASSES = {
  sea_salt: [35, 120, 240], // Blue
  dust: [225, 110, 180],    // Pink / Magenta
  smoke: [235, 75, 25],     // Orange / Red
  sulfate: [45, 195, 75]    // Green
};

let instruments = null;
let reverb = null;
let step = 0;
let lastStepTime = 0;

// Harmonic note sequences (D minor / Aeolian)
const CLASS_NOTES = {
  sea_salt: ['D4', 'F4', 'A4', 'C5'],   // Airy oceanic sine flute
  dust:     ['A3', 'C4', 'D4', 'F4'],   // Earthy desert kalimba
  smoke:    ['D2', 'A2', 'D3', 'F3'],   // Deep resonant warm cello drone
  sulfate:  ['F4', 'A4', 'C5', 'E5']    // Sparkling glassy celeste chime
};

export default {
  id: 'aerosols',
  colorClasses: COLOR_CLASSES,

  /**
   * Initialize and connect instruments.
   * @param {import('../audio.js').audio} audio
   */
  start(audio) {
    if (instruments) this.stop(audio);

    try {
      reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
      reverb.connect(audio.master);

      // 1. Sea Salt: Pure, ethereal sine flute
      const saltVol = new Tone.Volume(-Infinity);
      saltVol.connect(reverb);
      const saltSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.15, decay: 0.8, sustain: 0.5, release: 1.0 }
      });
      saltSynth.connect(saltVol);

      // 2. Dust: Warm, woody kalimba / marimba
      const dustVol = new Tone.Volume(-Infinity);
      dustVol.connect(reverb);
      const dustSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.008, decay: 0.45, sustain: 0.05, release: 0.6 }
      });
      dustSynth.connect(dustVol);

      // 3. Smoke: Filtered sawtooth warm cello / drone
      const smokeVol = new Tone.Volume(-Infinity);
      smokeVol.connect(reverb);
      const smokeFilter = new Tone.Filter(600, 'lowpass');
      smokeFilter.connect(smokeVol);
      const smokeSynth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.4, decay: 1.2, sustain: 0.8, release: 1.4 }
      });
      smokeSynth.connect(smokeFilter);

      // 4. Sulfate: Glassy metallic celeste
      const sulfateVol = new Tone.Volume(-Infinity);
      sulfateVol.connect(reverb);
      const sulfateSynth = new Tone.Synth({
        oscillator: { type: 'sine8' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.7 }
      });
      sulfateSynth.connect(sulfateVol);

      instruments = {
        sea_salt: { synth: saltSynth, vol: saltVol },
        dust:     { synth: dustSynth, vol: dustVol },
        smoke:    { synth: smokeSynth, vol: smokeVol, filter: smokeFilter },
        sulfate:  { synth: sulfateSynth, vol: sulfateVol }
      };
    } catch {
      // AudioContext may not be active in tests
    }

    step = 0;
    lastStepTime = 0;
  },

  /**
   * Called ~15 Hz while playing.
   * Maps color class coverage directly to instrument volumes and triggers polyphonic arpeggio.
   *
   * @param {import('../features.js').FrameFeatures} features
   * @param {import('../audio.js').audio} audio
   * @param {{ scanX: number }} state
   */
  update(features, audio, state) {
    if (!instruments || !features) return;

    const classes = features.classes || {};
    const coverages = {
      sea_salt: classes.sea_salt || classes.seasalt || 0,
      dust:     classes.dust || 0,
      smoke:    classes.smoke || 0,
      sulfate:  classes.sulfate || 0
    };

    // Update each instrument volume based on coverage (coverage = volume)
    for (const [key, cov] of Object.entries(coverages)) {
      const inst = instruments[key];
      if (!inst || !inst.vol) continue;

      if (cov <= 0.005) {
        inst.vol.volume.rampTo(-Infinity, 0.1);
      } else {
        // Boost subtle coverage (e.g. 5% coverage -> audible level; 25% -> full level)
        const gain = Math.min(1.0, Math.max(0, cov * 3.5));
        const db = Tone.gainToDb(gain) - 3; // gentle headroom
        inst.vol.volume.rampTo(db, 0.15);
      }
    }

    // Advance rhythmic cycle every ~200 ms to pulse active instruments
    const now = Tone.now();
    if (now - lastStepTime >= 0.20) {
      const noteIdx = step % 4;

      for (const [key, cov] of Object.entries(coverages)) {
        if (cov > 0.008) {
          const inst = instruments[key];
          const noteList = CLASS_NOTES[key];
          const note = noteList[noteIdx % noteList.length];
          const vel = Math.min(0.9, Math.max(0.2, cov * 2.5));

          try {
            inst.synth.triggerAttackRelease(note, '8n', now, vel);
          } catch {}
        }
      }

      step++;
      lastStepTime = now;
    }
  },

  /**
   * Generates a concise screen-reader caption.
   * @param {import('../features.js').FrameFeatures} features
   * @returns {string}
   */
  describe(features) {
    const classes = features?.classes || {};
    const salt = Math.round((classes.sea_salt || classes.seasalt || 0) * 100);
    const dust = Math.round((classes.dust || 0) * 100);
    const smoke = Math.round((classes.smoke || 0) * 100);
    const sulfate = Math.round((classes.sulfate || 0) * 100);

    const parts = [
      { name: 'sea salt spray', pct: salt },
      { name: 'desert dust', pct: dust },
      { name: 'wildfire smoke', pct: smoke },
      { name: 'volcanic & industrial sulfates', pct: sulfate }
    ].sort((a, b) => b.pct - a.pct);

    const dominant = parts[0];
    if (dominant.pct < 2) {
      return 'GEOS Aerosols: clear skies, minimal atmospheric aerosol density.';
    }

    return `Aerosols: dominant ${dominant.name} (${dominant.pct}%), with ${parts[1].name} (${parts[1].pct}%) and ${parts[2].name} (${parts[2].pct}%).`;
  },

  /**
   * Play sound for a probed region in explore mode.
   * @param {{ luma: number, hueName: string, motion: number }} region
   * @param {import('../audio.js').audio} audio
   */
  probe(region, audio) {
    if (!instruments) this.start(audio);
    if (!instruments) return;

    let targetKey = 'sea_salt';
    if (region?.hueName === 'warm') {
      targetKey = 'smoke';
    } else if (region?.hueName === 'green') {
      targetKey = 'sulfate';
    } else if (region?.hueName === 'cool') {
      targetKey = 'sea_salt';
    } else if (region?.luma > 0.4) {
      targetKey = 'dust';
    }

    const inst = instruments[targetKey];
    if (inst) {
      const note = CLASS_NOTES[targetKey][0];
      try {
        inst.vol.volume.setValueAtTime(0, Tone.now());
        inst.synth.triggerAttackRelease(note, '4n', Tone.now(), 0.8);
      } catch {}
    }
  },

  /**
   * Release and dispose instruments.
   * @param {import('../audio.js').audio} audio
   */
  stop(audio) {
    if (instruments) {
      for (const inst of Object.values(instruments)) {
        try {
          inst.synth.dispose();
          inst.vol.dispose();
          if (inst.filter) inst.filter.dispose();
        } catch {}
      }
      instruments = null;
    }
    if (reverb) {
      try {
        reverb.dispose();
      } catch {}
      reverb = null;
    }
    step = 0;
  }
};
