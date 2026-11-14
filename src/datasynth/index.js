/**
 * Earth Information Jukebox — Data Synth Module Entry Point
 *
 * Implements Phase 2 'Data Synth' per specification:
 * - Multi-voice Tone.js synth, one voice per variable
 * - Each voice with its own on/off toggle
 * - Pitch scale-snapped, warmer = higher
 * - Precipitation note density
 * - Solar shimmer pad brightness
 * - Wind filtered noise colour
 * - Humidity reverb wet
 * - CO2 pad detune tension
 * - Global Anomaly sub drone pitch drift
 * - Null value = that voice silent
 * - Exact values with units in describe()
 * - Real sampled instruments (Concert harp, flute)
 * - Per-place musical identity (key, mode, tempo)
 * - Convolution reverb
 * - Stereo spread per voice
 * - Smooth sweeps & clear compare marker sound
 */

export { createDataSynth } from './synth.js';
export {
  VARIABLES,
  VARIABLE_MAP,
  normalizeVariable,
  formatValue,
  clamp
} from './ranges.js';
export {
  SCALES,
  getScaleNotes,
  snapToNote,
  getMusicalIdentity,
  buildScaleNotes
} from './scales.js';
export { VoicePipeline } from './voices.js';
