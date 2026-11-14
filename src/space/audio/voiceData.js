// Planetary acoustics & fact-sheet derivations for Earth Information Jukebox.
// Strictly derived from NASA Planetary Fact Sheet values in planets.js.
import { PLANETS } from '../planets.js';

// Harmonic series rooted on C:
// Planet orbits follow harmonic steps from Neptune (longest orbit) to Mercury (shortest).
const HARMONIC_NOTES = {
  neptune: { fundamental: 'C2', harmonic: 'C3', freq: 65.41, harmonicFreq: 130.81 },
  uranus:  { fundamental: 'E2', harmonic: 'E3', freq: 82.41, harmonicFreq: 164.81 },
  saturn:  { fundamental: 'G2', harmonic: 'G3', freq: 98.00, harmonicFreq: 196.00 },
  jupiter: { fundamental: 'C3', harmonic: 'C4', freq: 130.81, harmonicFreq: 261.63 },
  mars:    { fundamental: 'E3', harmonic: 'E4', freq: 164.81, harmonicFreq: 329.63 },
  earth:   { fundamental: 'G3', harmonic: 'G4', freq: 196.00, harmonicFreq: 392.00 },
  venus:   { fundamental: 'C4', harmonic: 'C5', freq: 261.63, harmonicFreq: 523.25 },
  mercury: { fundamental: 'E4', harmonic: 'E5', freq: 329.63, harmonicFreq: 659.25 }
};

/**
 * Tremolo / pulsation rate derived from planetary day length (rotation period).
 * Fast rotating worlds (Jupiter 9.9h, Saturn 10.7h) pulse quickly;
 * slow rotating worlds (Venus 2802h, Mercury 4223h) undulate slowly.
 * @param {number} dayHours
 * @returns {number} Hz (0.15 .. 6.0)
 */
export function calculateTremoloRate(dayHours) {
  const hours = Math.max(9.9, Math.abs(dayHours));
  return Number((0.12 + 5.5 * Math.pow(10 / hours, 0.75)).toFixed(3));
}

/**
 * Brightness / lowpass filter cutoff derived from planetary mean surface temperature.
 * Range: -200 °C (Neptune) to +464 °C (Venus).
 * @param {number} tempC
 * @returns {number} Hz (380 .. 7200)
 */
export function calculateFilterCutoff(tempC) {
  const tNorm = Math.max(0, Math.min(1, (tempC + 200) / 664));
  return Math.round(380 * Math.pow(7200 / 380, Math.pow(tNorm, 0.8)));
}

/**
 * Filter resonance Q derived from planetary atmosphere structure.
 * @param {object} p planet fact-sheet entry
 * @returns {number}
 */
export function calculateResonance(p) {
  if (p.kind === 'rock') return 1.2; // Dry, solid surface with no/thin atmosphere
  if (p.kind === 'earth') return 2.0; // Temperate N2/O2 atmosphere
  if (p.kind === 'cloud') return 3.8; // Extreme 93-bar supercritical CO2 greenhouse
  if (p.kind === 'gas') return p.id === 'jupiter' || p.id === 'saturn' ? 3.0 : 2.4;
  return 1.8;
}

export const PLANET_AUDIO_DATA = PLANETS.map((p) => {
  const notes = HARMONIC_NOTES[p.id] || { fundamental: 'C3', harmonic: 'G3', freq: 130.81, harmonicFreq: 196.00 };
  const tremoloRate = calculateTremoloRate(p.dayHours);
  const filterCutoff = calculateFilterCutoff(p.tempC);
  const filterQ = calculateResonance(p);

  return {
    id: p.id,
    name: p.name,
    periodDays: p.periodDays,
    dayHours: p.dayHours,
    tempC: p.tempC,
    moons: p.moons,
    kind: p.kind,
    fundamentalNote: notes.fundamental,
    harmonicNote: notes.harmonic,
    fundamentalFreq: notes.freq,
    harmonicFreq: notes.harmonicFreq,
    tremoloRate,
    filterCutoff,
    filterQ,
    hasRings: Boolean(p.rings),
    isWindy: p.id === 'neptune',
    isSupercritical: p.id === 'venus',
    hasTiltWobble: Boolean(p.tilt && p.tilt > 80),
    // Relative loudness balance across the frequency spectrum
    // (Bass frequencies need slightly more energy to sound equally loud; high treble needs slightly less)
    balanceGain: p.fundamentalFreq < 100 ? 1.25 : p.fundamentalFreq < 200 ? 1.0 : 0.82
  };
});

export const PLANET_AUDIO_BY_ID = Object.fromEntries(
  PLANET_AUDIO_DATA.map((data) => [data.id, data])
);

export function getPlanetAudioData(id) {
  return PLANET_AUDIO_BY_ID[id] || null;
}

/**
 * Sun drone acoustic parameters:
 * Photosphere temperature ~5500 °C, helioseismology acoustic p-mode ~3.3 mHz.
 * Modeled as deep C1/C2 fundamental with 0.06 Hz solar granulation pulsation.
 */
export const SUN_AUDIO_DATA = {
  id: 'sun',
  name: 'Sun',
  fundamentalFreq: 65.41, // C2
  subFreq: 32.70,         // C1
  overtoneFreq: 98.00,    // G2
  granulationRate: 0.06,  // Matches uTime * 0.06 shader granulation in solarSystem.js
  filterCutoff: 180,      // Lowpass rumble
  filterQ: 1.5,
  balanceGain: 0.95
};
