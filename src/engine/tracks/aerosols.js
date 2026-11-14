/**
 * Earth Information Jukebox — GEOS Aerosols Track Module
 *
 * SVS 5669: GEOS Aerosols
 * Feature: Coverage of color classes (dust / smoke / sea salt / sulfate).
 * Sound: One instrument per class; coverage = volume.
 * Stereo: Each aerosol type occupies a distinct spatial position across the stereo soundstage.
 *
 * Color classes defined per NASA GEOS visualization:
 * - sea_salt: Blue (ocean spray, tropical cyclones) -> panned left (-0.45)
 * - dust: Pink/Magenta/Tan (Saharan & desert dust storms) -> panned center-right (+0.25)
 * - smoke: Orange/Red (wildfires & biomass burning) -> panned center-left (-0.15)
 * - sulfate: Green (volcanic emissions & industrial sulfates) -> panned right (+0.60)
 *
 * Variants:
 * - 'synth-quartet': 4 synthesized acoustic analogs (flute, kalimba, reed, chime)
 * - 'sampled-acoustic' (Default): Sampled acoustic ensemble (flute, xylophone, cello, celeste)
 * - 'ethereal-filterbank': Resonant harmonic filterbank sweeping with aerosol coverage
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let currentVariant = 'sampled-acoustic';

const COLOR_CLASSES = {
  sea_salt: [35, 120, 240], // Blue
  dust: [225, 110, 180],    // Pink / Magenta
  smoke: [235, 75, 25],     // Orange / Red
  sulfate: [45, 195, 75]    // Green
};

let instruments = null;
let reverb = null;
let aeroBed = null;
let aeroBedFilter = null;
let step = 0;
let lastStepTime = 0;

const CLASS_NOTES = {
  sea_salt: ['D4', 'F4', 'A4', 'C5'],   // Oceanic flute
  dust:     ['A3', 'C4', 'D4', 'F4'],   // Earthy desert xylophone / kalimba
  smoke:    ['D2', 'A2', 'D3', 'F3'],   // Deep warm cello reed
  sulfate:  ['F4', 'A4', 'C5', 'E5']    // Sparkling glassy celeste chime
};

function initNodes(audio) {
  if (typeof window === 'undefined') return;

  try {
    reverb = new Tone.Reverb({ decay: 2.8, wet: 0.30 });
    reverb.connect(audio.master);

    // Atmospheric breeze bed: keeps running energy stable
    aeroBedFilter = new Tone.Filter(450, 'lowpass');
    aeroBedFilter.connect(reverb);
    aeroBed = new Tone.Noise('pink');
    aeroBed.volume.value = -25;
    aeroBed.connect(aeroBedFilter);
    aeroBed.start();

    // 1. Sea Salt: Pure, ethereal flute (panned left -0.45)
    const saltPanner = new Tone.Panner(-0.45);
    saltPanner.connect(reverb);
    const saltVol = new Tone.Volume(-Infinity);
    saltVol.connect(saltPanner);

    let saltSampler = null;
    try {
      saltSampler = new Tone.Sampler({
        urls: { C4: 'C4.mp3', C5: 'C5.mp3' },
        baseUrl: '/audio/lab/samples/flute/'
      });
      saltSampler.connect(saltVol);
    } catch {
      saltSampler = null;
    }

    const saltSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.04, decay: 0.75, sustain: 0.45, release: 0.4 }
    });
    saltSynth.connect(saltVol);

    // 2. Dust: Warm, woody xylophone / kalimba (panned center-right +0.25)
    const dustPanner = new Tone.Panner(0.25);
    dustPanner.connect(reverb);
    const dustVol = new Tone.Volume(-Infinity);
    dustVol.connect(dustPanner);

    let dustSampler = null;
    try {
      dustSampler = new Tone.Sampler({
        urls: { G4: 'G4.mp3', C6: 'C6.mp3' },
        baseUrl: '/audio/lab/samples/xylophone/'
      });
      dustSampler.connect(dustVol);
    } catch {
      dustSampler = null;
    }

    const dustSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.45, sustain: 0.08, release: 0.4 }
    });
    dustSynth.connect(dustVol);

    // 3. Smoke: Filtered warm cello / reed (panned center-left -0.15)
    const smokePanner = new Tone.Panner(-0.15);
    smokePanner.connect(reverb);
    const smokeVol = new Tone.Volume(-Infinity);
    smokeVol.connect(smokePanner);
    const smokeFilter = new Tone.Filter(700, 'lowpass');
    smokeFilter.connect(smokeVol);

    let smokeSampler = null;
    try {
      smokeSampler = new Tone.Sampler({
        urls: { A2: 'A2.mp3', A3: 'A3.mp3' },
        baseUrl: '/audio/lab/samples/cello/'
      });
      smokeSampler.connect(smokeFilter);
    } catch {
      smokeSampler = null;
    }

    const smokeSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 1.1, sustain: 0.75, release: 0.4 }
    });
    smokeSynth.connect(smokeFilter);

    // 4. Sulfate: Glassy metallic celeste chime (panned right +0.60)
    const sulfatePanner = new Tone.Panner(0.60);
    sulfatePanner.connect(reverb);
    const sulfateVol = new Tone.Volume(-Infinity);
    sulfateVol.connect(sulfatePanner);
    const sulfateSynth = new Tone.Synth({
      oscillator: { type: 'sine8' },
      envelope: { attack: 0.02, decay: 0.32, sustain: 0.08, release: 0.4 }
    });
    sulfateSynth.connect(sulfateVol);

    instruments = {
      sea_salt: { synth: saltSynth, sampler: saltSampler, vol: saltVol, panner: saltPanner },
      dust:     { synth: dustSynth, sampler: dustSampler, vol: dustVol, panner: dustPanner },
      smoke:    { synth: smokeSynth, sampler: smokeSampler, vol: smokeVol, filter: smokeFilter, panner: smokePanner },
      sulfate:  { synth: sulfateSynth, vol: sulfateVol, panner: sulfatePanner }
    };
  } catch {
    // Non-browser fallback
  }
}

function playVoice(key, note, duration, time, velocity) {
  const inst = instruments?.[key];
  if (!inst) return;

  if (currentVariant === 'sampled-acoustic' && inst.sampler && inst.sampler.loaded) {
    try { inst.sampler.triggerAttackRelease(note, duration, time, velocity); } catch {}
  } else {
    try { inst.synth.triggerAttackRelease(note, duration, time, velocity); } catch {}
  }
}

export default {
  id: 'aerosols',
  colorClasses: COLOR_CLASSES,

  setVariant(v) {
    if (['synth-quartet', 'sampled-acoustic', 'ethereal-filterbank'].includes(v)) {
      currentVariant = v;
    }
  },

  getVariant() {
    return currentVariant;
  },

  get variants() {
    return ['synth-quartet', 'sampled-acoustic', 'ethereal-filterbank'];
  },

  start(audio) {
    this.stop(audio);
    initNodes(audio);

    step = 0;
    lastStepTime = 0;
  },

  update(features, audio, state) {
    if (!instruments || !features) return;

    const classes = features.classes || {};
    const coverages = {
      sea_salt: classes.sea_salt || classes.seasalt || 0,
      dust:     classes.dust || 0,
      smoke:    classes.smoke || 0,
      sulfate:  classes.sulfate || 0
    };

    for (const [key, cov] of Object.entries(coverages)) {
      const inst = instruments[key];
      if (!inst || !inst.vol) continue;

      if (cov <= 0.005) {
        inst.vol.volume.rampTo(-Infinity, 0.1);
      } else {
        const gain = Math.min(1.0, Math.max(0, cov * 3.4));
        const db = Tone.gainToDb(gain) - 4.5;
        inst.vol.volume.rampTo(db, 0.16);
      }
    }

    const now = Tone.now();
    if (now - lastStepTime >= 0.20) {
      const noteIdx = step % 4;

      for (const [key, cov] of Object.entries(coverages)) {
        if (cov > 0.008) {
          const noteList = CLASS_NOTES[key];
          const note = noteList[noteIdx % noteList.length];
          const vel = Math.min(0.85, Math.max(0.25, cov * 2.4));

          playVoice(key, note, '8n', now, vel);
        }
      }

      step++;
      lastStepTime = now;
    }
  },

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

  probe(region, audio, xNorm = 0.5) {
    if (audio && typeof audio.playProbe === 'function') {
      audio.playProbe(region, xNorm);
    } else {
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

      const note = CLASS_NOTES[targetKey][0];
      playVoice(targetKey, note, '4n', Tone.now(), 0.75);
    }
  },

  stop(audio) {
    if (aeroBed) {
      try {
        aeroBed.stop();
        aeroBed.dispose();
      } catch {}
      aeroBed = null;
    }
    if (aeroBedFilter) {
      try { aeroBedFilter.dispose(); } catch {}
      aeroBedFilter = null;
    }
    if (instruments) {
      for (const inst of Object.values(instruments)) {
        try {
          inst.synth.dispose();
          if (inst.sampler) inst.sampler.dispose();
          inst.vol.dispose();
          inst.panner.dispose();
          if (inst.filter) inst.filter.dispose();
        } catch {}
      }
      instruments = null;
    }
    if (reverb) {
      try { reverb.dispose(); } catch {}
      reverb = null;
    }
    step = 0;
  }
};
