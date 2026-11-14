/**
 * Earth Information Jukebox — Night Lights Track Module
 *
 * SVS 5313: Night Lights 2012–2023 (VIIRS Day/Night Band)
 * Feature: Brightness under a scan line sweeping left to right across the globe.
 * Sound: Pentatonic plucked notes (harp / celeste); bright = loud + high; dark = silence.
 * Scan sweep: state.scanX advances 0..1 over ~8 seconds.
 * Stereo: Panned by scanX position across stereo field (-0.85 to +0.85).
 *
 * Variants:
 * - 'fm-bell': Physical FM bell pluck with metallic inharmonic ratio
 * - 'sampled-harp' (Default): Acoustic harp sampler backed by CC0 samples with synth fallback
 * - 'hybrid-shimmer': Layered acoustic harp + crystalline FM shimmer in Lydian Pentatonic
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let currentVariant = 'sampled-harp';

// Audio nodes
let panner = null;
let reverb = null;
let chorus = null;
let sampler = null;
let synth = null;
let fmSynth = null;
let cosmicBed = null;
let cosmicFilter = null;
let lastTriggerTime = 0;
let lastCol = -1;

function getApproxRegion(scanX) {
  if (scanX < 0.12) return 'Pacific & Western North America';
  if (scanX < 0.25) return 'Eastern North & South America';
  if (scanX < 0.35) return 'Atlantic Basin';
  if (scanX < 0.50) return 'Europe & Africa';
  if (scanX < 0.65) return 'Middle East & Central Asia';
  if (scanX < 0.82) return 'South & East Asia';
  return 'Japan, Australia & Pacific';
}

function initNodes(audio) {
  if (typeof window === 'undefined') return;

  try {
    panner = new Tone.Panner(0);
    panner.connect(audio.master);

    reverb = new Tone.Reverb({ decay: 2.8, wet: 0.28 });
    reverb.connect(panner);

    chorus = new Tone.Chorus(2.0, 2.5, 0.25);
    chorus.connect(reverb);

    // Warm ambient cosmic starlight bed: sustains running energy to prevent >6 dB jumps
    cosmicFilter = new Tone.Filter(600, 'lowpass');
    cosmicFilter.connect(reverb);
    cosmicBed = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 3,
      options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 1.5, sustain: 0.8, release: 0.4 }
      }
    });
    cosmicBed.volume.value = -23;
    cosmicBed.connect(cosmicFilter);
    cosmicBed.triggerAttack(['C3', 'G3'], Tone.now() + 0.05, 0.5);

    // Primary fallback / core pluck synthesizer (smooth 18ms attack avoids sudden >6 dB jumps)
    synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      voice: Tone.Synth,
      options: {
        oscillator: { type: 'triangle8' },
        envelope: {
          attack: 0.018,
          decay: 0.55,
          sustain: 0.05,
          release: 0.75
        }
      }
    });
    synth.volume.value = -6;
    synth.connect(reverb);

    // FM Bell synth for Variant A & C
    fmSynth = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 6,
      options: {
        harmonicity: 2.01,
        modulationIndex: 1.6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.016, decay: 0.45, sustain: 0.02, release: 0.6 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.012, decay: 0.25, sustain: 0.0, release: 0.2 }
      }
    });
    fmSynth.volume.value = -8;
    fmSynth.connect(chorus);

    // Acoustic Sampler for Variant B & C (using /audio/lab/samples/harp/)
    try {
      sampler = new Tone.Sampler({
        urls: {
          C3: 'C3.mp3',
          C5: 'C5.mp3'
        },
        baseUrl: '/audio/lab/samples/harp/'
      });
      sampler.volume.value = -5;
      sampler.connect(reverb);
    } catch {
      sampler = null;
    }
  } catch {
    // Non-browser fallback
  }
}

function triggerPluck(note, duration, time, velocity) {
  const safeVel = Math.min(0.85, Math.max(0.2, velocity));

  if (currentVariant === 'fm-bell') {
    if (fmSynth) {
      try { fmSynth.triggerAttackRelease(note, duration, time, safeVel); } catch {}
    } else if (synth) {
      try { synth.triggerAttackRelease(note, duration, time, safeVel); } catch {}
    }
  } else if (currentVariant === 'sampled-harp') {
    if (sampler && sampler.loaded) {
      try { sampler.triggerAttackRelease(note, duration, time, safeVel); } catch {}
    } else if (synth) {
      try { synth.triggerAttackRelease(note, duration, time, safeVel); } catch {}
    }
  } else {
    // hybrid-shimmer
    if (sampler && sampler.loaded) {
      try { sampler.triggerAttackRelease(note, duration, time, safeVel * 0.8); } catch {}
    } else if (synth) {
      try { synth.triggerAttackRelease(note, duration, time, safeVel * 0.8); } catch {}
    }
    if (fmSynth) {
      try { fmSynth.triggerAttackRelease(note, duration, time + 0.018, safeVel * 0.4); } catch {}
    }
  }
}

export default {
  id: 'nightlights',
  colorClasses: undefined,

  setVariant(v) {
    if (['fm-bell', 'sampled-harp', 'hybrid-shimmer'].includes(v)) {
      currentVariant = v;
    }
  },

  getVariant() {
    return currentVariant;
  },

  get variants() {
    return ['fm-bell', 'sampled-harp', 'hybrid-shimmer'];
  },

  start(audio) {
    this.stop(audio);
    initNodes(audio);

    lastTriggerTime = 0;
    lastCol = -1;
  },

  update(features, audio, state) {
    if (!features) return;

    const scanX = typeof state?.scanX === 'number' ? state.scanX : 0;
    const width = features.width || 160;
    const height = features.height || 90;
    const col = Math.max(0, Math.min(width - 1, Math.floor(scanX * (width - 1))));

    // Smoothly pan stereo position as scan line moves West to East
    if (panner && panner.pan) {
      const panVal = audio.panFromX ? audio.panFromX(scanX) : (scanX - 0.5) * 1.8;
      panner.pan.rampTo(panVal, 0.08);
    }

    const colLuma = features.columnLuma ? features.columnLuma[col] : features.meanLuma;

    if (colLuma < 0.02) {
      lastCol = col;
      return;
    }

    const now = Tone.now();
    if (now - lastTriggerTime < 0.12) {
      return;
    }

    const scaleName = currentVariant === 'hybrid-shimmer' ? 'lydianPentatonic' : 'pentatonic';
    const notes = audio.scale(scaleName);
    const scaleLen = notes.length;
    const lumaGrid = features.luma;

    let topMax = 0, topY = 0;
    let midMax = 0, midY = 0;
    let botMax = 0, botY = 0;

    const h3 = Math.floor(height / 3);
    for (let y = 0; y < height; y++) {
      const lum = lumaGrid ? lumaGrid[y * width + col] : colLuma;
      if (y < h3) {
        if (lum > topMax) { topMax = lum; topY = y; }
      } else if (y < h3 * 2) {
        if (lum > midMax) { midMax = lum; midY = y; }
      } else {
        if (lum > botMax) { botMax = lum; botY = y; }
      }
    }

    const candidates = [
      { max: topMax, y: topY },
      { max: midMax, y: midY },
      { max: botMax, y: botY }
    ].filter(c => c.max > 0.038);

    if (candidates.length === 0 && colLuma >= 0.02) {
      const noteIdx = Math.floor(Math.min(0.999, colLuma * 2.5) * (scaleLen / 2)) + Math.floor(scaleLen / 4);
      const velocity = Math.min(0.8, colLuma * 2.5 + 0.2);
      triggerPluck(notes[noteIdx], '8n', now, velocity);
      lastTriggerTime = now;
    } else {
      candidates.sort((a, b) => b.max - a.max);
      const toPlay = candidates.slice(0, 2);

      for (let i = 0; i < toPlay.length; i++) {
        const item = toPlay[i];
        const latNorm = 1.0 - (item.y / height);
        const pitchNorm = Math.min(0.999, Math.max(0, 0.45 * latNorm + 0.55 * item.max));
        const noteIdx = Math.floor(pitchNorm * scaleLen);
        const velocity = Math.min(0.85, Math.max(0.25, item.max * 2.4));

        triggerPluck(notes[noteIdx], '8n', now + i * 0.04, velocity);
      }
      lastTriggerTime = now;
    }

    lastCol = col;
  },

  describe(features) {
    const scanX = features?.scanX ?? 0;
    const lonDeg = Math.round(scanX * 360 - 180);
    const lonStr = `${Math.abs(lonDeg)}°${lonDeg >= 0 ? 'E' : 'W'}`;
    const region = getApproxRegion(scanX);

    const width = features?.width || 160;
    const col = Math.max(0, Math.min(width - 1, Math.floor(scanX * (width - 1))));
    const colLuma = features?.columnLuma ? features.columnLuma[col] : (features?.meanLuma || 0);

    let densityDesc = 'dark oceans and unlit wilderness';
    if (colLuma > 0.16) {
      densityDesc = 'dense, brilliant urban lighting clusters';
    } else if (colLuma > 0.08) {
      densityDesc = 'moderate city illumination and transit corridors';
    } else if (colLuma > 0.02) {
      densityDesc = 'sparse rural and coastal settlements';
    }

    return `Scanning ${region} (${lonStr}): ${densityDesc}.`;
  },

  probe(region, audio, xNorm = 0.5) {
    if (audio && typeof audio.playProbe === 'function') {
      audio.playProbe(region, xNorm);
    } else {
      const notes = audio.scale('pentatonic');
      const lum = region?.luma ?? 0;
      const noteIdx = Math.floor(Math.min(0.999, Math.max(0, lum * 1.8)) * notes.length);
      triggerPluck(notes[noteIdx], '4n', Tone.now(), Math.min(0.85, lum * 2.0 + 0.25));
    }
  },

  stop(audio) {
    if (cosmicBed) {
      try {
        cosmicBed.releaseAll();
        cosmicBed.dispose();
      } catch {}
      cosmicBed = null;
    }
    if (cosmicFilter) {
      try { cosmicFilter.dispose(); } catch {}
      cosmicFilter = null;
    }
    if (synth) {
      try { synth.releaseAll(); synth.dispose(); } catch {}
      synth = null;
    }
    if (fmSynth) {
      try { fmSynth.releaseAll(); fmSynth.dispose(); } catch {}
      fmSynth = null;
    }
    if (sampler) {
      try { sampler.releaseAll(); sampler.dispose(); } catch {}
      sampler = null;
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
    lastTriggerTime = 0;
    lastCol = -1;
  }
};
