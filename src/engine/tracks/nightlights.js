/**
 * Earth Information Jukebox — Night Lights Track Module
 *
 * SVS 5313: Night Lights 2012–2023
 * Feature: Brightness under a scan line sweeping left to right across the globe.
 * Sound: Pentatonic plucked notes (harp / celeste); bright = loud + high; dark = silence.
 * Scan sweep: state.scanX advances 0..1 over ~8 seconds.
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let synth = null;
let reverb = null;
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

export default {
  id: 'nightlights',
  colorClasses: undefined,

  /**
   * Initialize and connect instruments.
   * @param {import('../audio.js').audio} audio
   */
  start(audio) {
    if (synth) this.stop(audio);

    try {
      reverb = new Tone.Reverb({ decay: 2.2, wet: 0.3 });
      reverb.connect(audio.master);

      synth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'triangle8' },
          envelope: {
            attack: 0.005,
            decay: 0.4,
            sustain: 0.02,
            release: 0.6
          }
        }
      });
      synth.volume.value = -4;
      synth.connect(reverb);
    } catch {
      // AudioContext may not be running in tests
    }

    lastTriggerTime = 0;
    lastCol = -1;
  },

  /**
   * Called ~15 Hz while playing.
   * Reads brightness along the current scan column and triggers plucked notes.
   *
   * @param {import('../features.js').FrameFeatures} features
   * @param {import('../audio.js').audio} audio
   * @param {{ scanX: number }} state
   */
  update(features, audio, state) {
    if (!synth || !features) return;

    const scanX = typeof state?.scanX === 'number' ? state.scanX : 0;
    const width = features.width || 160;
    const height = features.height || 90;
    const col = Math.max(0, Math.min(width - 1, Math.floor(scanX * (width - 1))));

    // Determine column luma
    const colLuma = features.columnLuma ? features.columnLuma[col] : features.meanLuma;

    // Dark threshold: ocean or wilderness at night is silent
    if (colLuma < 0.02) {
      lastCol = col;
      return;
    }

    const now = Tone.now();
    // Throttle note triggers to ~110 ms to maintain a clear musical arpeggio rhythm
    if (now - lastTriggerTime < 0.11) {
      return;
    }

    // Inspect vertical segments along this column to find bright latitude clusters
    const lumaGrid = features.luma;
    const notes = audio.scale('pentatonic');
    const scaleLen = notes.length;

    // Sample top, mid, and bottom thirds of the column
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
    ].filter(c => c.max > 0.04);

    if (candidates.length === 0 && colLuma >= 0.02) {
      // Gentle single note based on overall column brightness
      const noteIdx = Math.floor(Math.min(0.999, colLuma * 2.5) * (scaleLen / 2)) + Math.floor(scaleLen / 4);
      const velocity = Math.min(0.9, colLuma * 3.0 + 0.1);
      try {
        synth.triggerAttackRelease(notes[noteIdx], '16n', now, velocity);
        lastTriggerTime = now;
      } catch {}
    } else {
      // Sort candidates by brightness and trigger up to 2 distinct plucked voices
      candidates.sort((a, b) => b.max - a.max);
      const toPlay = candidates.slice(0, 2);

      for (let i = 0; i < toPlay.length; i++) {
        const item = toPlay[i];
        // Latitude mapping: higher latitude (smaller y) & higher brightness -> higher pitch
        const latNorm = 1.0 - (item.y / height); // 1.0 = North, 0.0 = South
        const pitchNorm = Math.min(0.999, Math.max(0, 0.4 * latNorm + 0.6 * item.max));
        const noteIdx = Math.floor(pitchNorm * scaleLen);
        const velocity = Math.min(0.95, Math.max(0.15, item.max * 2.8));

        try {
          synth.triggerAttackRelease(notes[noteIdx], '16n', now + i * 0.03, velocity);
        } catch {}
      }
      lastTriggerTime = now;
    }

    lastCol = col;
  },

  /**
   * Generates a concise screen-reader caption describing the current view.
   * @param {import('../features.js').FrameFeatures} features
   * @returns {string}
   */
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

  /**
   * Play sound for a probed region in explore mode.
   * @param {{ luma: number, hueName: string, motion: number }} region
   * @param {import('../audio.js').audio} audio
   */
  probe(region, audio) {
    if (!synth) this.start(audio);
    if (!synth) return;

    const notes = audio.scale('pentatonic');
    const lum = region?.luma ?? 0;

    if (lum < 0.025) {
      // Quiet, deep bass tone for unlit wilderness/ocean
      try {
        synth.triggerAttackRelease(notes[0], '8n', Tone.now(), 0.1);
      } catch {}
      return;
    }

    // Brighter region -> higher pitch and clear starlight pluck
    const noteIdx = Math.floor(Math.min(0.999, Math.max(0, lum * 1.8)) * notes.length);
    const velocity = Math.min(1.0, Math.max(0.2, lum * 2.5 + 0.2));

    try {
      synth.triggerAttackRelease(notes[noteIdx], '8n', Tone.now(), velocity);
    } catch {}
  },

  /**
   * Release and dispose instruments.
   * @param {import('../audio.js').audio} audio
   */
  stop(audio) {
    if (synth) {
      try {
        synth.releaseAll();
        synth.dispose();
      } catch {}
      synth = null;
    }
    if (reverb) {
      try {
        reverb.dispose();
      } catch {}
      reverb = null;
    }
  }
};
