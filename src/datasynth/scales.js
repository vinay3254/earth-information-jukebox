/**
 * Earth Information Jukebox — Data Synth Scales & Pitch Quantization
 *
 * Provides scale snapping so all sonified pitches are musically consonant,
 * melodic, and accessible.
 */

let engineAudio = null;
try {
  // Use engine scale table if available
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

/**
 * Get scale notes array.
 */
export function getScaleNotes(scaleName = 'pentatonic') {
  if (engineAudio && typeof engineAudio.scale === 'function' && SCALES[scaleName] === undefined) {
    const s = engineAudio.scale(scaleName);
    if (s && s.length) return s;
  }
  return SCALES[scaleName] || SCALES.pentatonic;
}

/**
 * Snap a normalized 0..1 value to a scale note.
 * Clamps to 0..0.999 to avoid index overflow.
 */
export function snapToNote(normVal, scaleName = 'pentatonic') {
  if (normVal === null || normVal === undefined || isNaN(normVal)) {
    return null;
  }
  const notes = getScaleNotes(scaleName);
  const clamped = Math.max(0, Math.min(0.9999, Number(normVal)));
  const idx = Math.floor(clamped * notes.length);
  return notes[idx];
}
