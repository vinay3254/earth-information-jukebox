/**
 * Earth Information Jukebox — Data Synth Scales & Pitch Quantization
 *
 * Provides scale snapping so all sonified pitches are musically consonant,
 * melodic, and accessible.
 *
 * Implements Per-Place Musical Identity derived from climate baseline:
 * - Polar/Freezing (Greenland): D Minor Pentatonic / Aeolian (crystalline, cold, contemplative)
 * - Temperate Mountain (California): E Dorian (expansive, snowpack/drought contrast)
 * - Marine/Reef (Great Barrier Reef): G Lydian / Ocean Pentatonic (luminous, oceanic)
 * - Monsoon Subtropical (Delhi): A Mixolydian (dynamic, vibrant, heat-shimmer)
 * - Tropical Rainforest (Amazon): F Major Pentatonic (lush, teeming with life)
 * - Arid Steppe (Sahel): E Phrygian / Desert scale (dry, heat haze, open fifths)
 */

let engineAudio = null;
try {
  const mod = await import('../engine/audio.js');
  engineAudio = mod.audio;
} catch {
  // Fallback to local scale tables if loaded independently
}

export const SCALES = {
  pentatonic: [
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6', 'G6', 'A6'
  ],
  leadScale: [
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6'
  ],
  pluckScale: [
    'C4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5'
  ],
  dorian: [
    'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3',
    'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
    'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
    'D5', 'E5', 'F5', 'G5', 'A5'
  ],
  major: [
    'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'
  ]
};

// Mode definitions by musical intervals (semitones above root)
const MODES = {
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Generate a multi-octave note array from root note and intervals.
 */
export function buildScaleNotes(rootNote, intervals, startOctave = 3, endOctave = 6) {
  const rootPitch = rootNote.replace(/[0-9]/g, '');
  const rootIndex = NOTE_NAMES.indexOf(rootPitch);
  if (rootIndex === -1) return SCALES.leadScale;

  const notes = [];
  for (let oct = startOctave; oct <= endOctave; oct++) {
    for (const semitone of intervals) {
      const idx = rootIndex + semitone;
      const noteName = NOTE_NAMES[idx % 12];
      const noteOct = oct + Math.floor(idx / 12);
      if (noteOct <= endOctave) {
        notes.push(`${noteName}${noteOct}`);
      }
    }
  }
  return notes.length ? notes : SCALES.leadScale;
}

/**
 * Per-Place Climate Mapping:
 * Derive musical key, mode, and scale notes from the region's climate data.
 */
export function getMusicalIdentity(region) {
  if (!region || !Array.isArray(region.years) || region.years.length === 0) {
    return {
      key: 'C',
      mode: 'majorPentatonic',
      label: 'C Major Pentatonic',
      leadNotes: SCALES.leadScale,
      pluckNotes: SCALES.pluckScale,
      padNotes: ['C4', 'G4', 'C5', 'E5'],
      baseBpm: 84
    };
  }

  // Calculate mean temperature and rainfall across all recorded years
  const validTemps = region.years.map((y) => y.tempC).filter((t) => t != null && !isNaN(t));
  const validRain = region.years.map((y) => y.precipMm).filter((p) => p != null && !isNaN(p));
  const meanTemp = validTemps.length ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : 15;
  const meanRain = validRain.length ? validRain.reduce((a, b) => a + b, 0) / validRain.length : 800;

  let key = 'C';
  let modeName = 'majorPentatonic';
  let label = '';
  let padNotes = ['C4', 'G4', 'C5', 'E5'];

  if (meanTemp < 0) {
    // Polar / Arctic (e.g. Greenland: mean ~ -5 °C)
    key = 'D';
    modeName = 'minorPentatonic';
    label = 'D Minor Pentatonic (Arctic crystalline)';
    padNotes = ['D4', 'A4', 'D5', 'F5'];
  } else if (meanTemp < 16) {
    // Temperate Mountain (e.g. California: mean ~ 12 °C)
    key = 'E';
    modeName = 'dorian';
    label = 'E Dorian (Alpine mountain)';
    padNotes = ['E4', 'B4', 'E5', 'G5'];
  } else if (meanTemp < 23) {
    // Marine Ocean Warmth (e.g. Great Barrier Reef: mean ~ 22 °C)
    key = 'G';
    modeName = 'lydian';
    label = 'G Lydian (Luminous oceanic)';
    padNotes = ['G4', 'D5', 'G5', 'B5'];
  } else if (meanTemp < 27) {
    if (meanRain > 1500) {
      // Equatorial Tropical Rainforest (e.g. Amazon: mean ~ 26 °C, rain > 2000 mm)
      key = 'F';
      modeName = 'majorPentatonic';
      label = 'F Major Pentatonic (Rainforest canopy)';
      padNotes = ['F4', 'C5', 'F5', 'A5'];
    } else {
      // Subtropical Monsoon (e.g. Delhi: mean ~ 25 °C, rain ~ 800 mm)
      key = 'A';
      modeName = 'mixolydian';
      label = 'A Mixolydian (Subtropical monsoon)';
      padNotes = ['A4', 'E5', 'A5', 'C#6'];
    }
  } else {
    // Arid / High Heat (e.g. Sahel: mean ~ 29 °C)
    key = 'E';
    modeName = 'phrygian';
    label = 'E Phrygian (Desert heat)';
    padNotes = ['E4', 'B4', 'E5', 'G5'];
  }

  const intervals = MODES[modeName] || MODES.majorPentatonic;
  const leadNotes = buildScaleNotes(key, intervals, 3, 6);
  const pluckNotes = buildScaleNotes(key, intervals, 4, 6);

  // Derive tempo from rainfall: drier = 68-76 bpm, rainier = 96-120 bpm
  const rainNorm = Math.max(0, Math.min(1, meanRain / 2600));
  const baseBpm = Math.round(68 + rainNorm * 48);

  return {
    key,
    mode: modeName,
    label,
    leadNotes,
    pluckNotes,
    padNotes,
    baseBpm,
    meanTemp,
    meanRain
  };
}

/**
 * Get scale notes array.
 */
export function getScaleNotes(scaleSource = 'pentatonic') {
  if (Array.isArray(scaleSource)) return scaleSource;
  if (engineAudio && typeof engineAudio.scale === 'function' && SCALES[scaleSource] === undefined) {
    const s = engineAudio.scale(scaleSource);
    if (s && s.length) return s;
  }
  return SCALES[scaleSource] || SCALES.pentatonic;
}

/**
 * Snap a normalized 0..1 value to a scale note.
 * Clamps to 0..0.999 to avoid index overflow.
 */
export function snapToNote(normVal, scaleSource = 'pentatonic') {
  if (normVal === null || normVal === undefined || isNaN(normVal)) {
    return null;
  }
  const notes = getScaleNotes(scaleSource);
  const clamped = Math.max(0, Math.min(0.9999, Number(normVal)));
  const idx = Math.floor(clamped * notes.length);
  return notes[idx];
}
