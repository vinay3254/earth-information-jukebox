/**
 * Earth Information Jukebox — Data Synth Ranges & Variable Definitions
 *
 * Defines sensible min/max ranges calibrated across all 6 NASA EIC regions:
 * - Greenland Ice Sheet (Ilulissat) [polar, high wind, freezing, low precip]
 * - Amazon Rainforest (Rondônia)    [tropical, high precip, high humidity, warm]
 * - Sahel (Lake Chad basin)         [semi-arid, high heat, high solar, low humidity]
 * - Delhi & Indo-Gangetic Plain     [subtropical, extreme summer heat, urban]
 * - Great Barrier Reef              [marine, ocean warmth, high humidity]
 * - California (Sierra Nevada)      [temperate, drought swings, wildfire]
 *
 * Each variable has calibrated ranges so regional differences and 40-year climate trends
 * are immediately and dramatically audible.
 */

export const VARIABLES = [
  {
    name: 'tempC',
    label: 'Temperature',
    unit: '°C',
    role: 'lead pitch (scale-snapped, warmer = higher)',
    min: -15, // Arctic winter / Greenland annual mean lows
    max: 35,  // Sahel & Delhi summer / annual mean highs
    scale: 'pentatonic'
  },
  {
    name: 'precipMm',
    label: 'Precipitation',
    unit: 'mm',
    role: 'plucked pentatonic note density',
    min: 0,
    max: 3000, // Amazon ~2500 mm vs Sahel/Greenland ~250 mm
    scale: 'pentatonic'
  },
  {
    name: 'solar',
    label: 'Solar Irradiance',
    unit: 'kWh/m²/day',
    role: 'shimmer/high pad brightness',
    min: 1.5, // Greenland polar lows
    max: 7.5  // Sahel equatorial solar peaks
  },
  {
    name: 'windMs',
    label: 'Wind Speed',
    unit: 'm/s',
    role: 'filtered noise colour',
    min: 0.5, // Calm inland regions
    max: 12.0 // Coastal & Arctic gale conditions
  },
  {
    name: 'humidity',
    label: 'Relative Humidity',
    unit: '%',
    role: 'reverb wet',
    min: 10, // Arid Sahel dry season
    max: 95  // Amazon rainforest & coral reef moisture
  },
  {
    name: 'co2ppm',
    label: 'Atmospheric CO₂',
    unit: 'ppm',
    role: 'pad detune tension (0 → +35 cents)',
    min: 335, // 1981 historical baseline (~340 ppm)
    max: 435  // Current & near-future peak (~425+ ppm)
  },
  {
    name: 'globalAnomalyC',
    label: 'Global Temp Anomaly',
    unit: '°C',
    role: 'slow sub drone pitch drift',
    min: -0.2, // Early 1980s baseline
    max: 1.6   // Modern peak warming anomaly
  }
];

export const VARIABLE_MAP = Object.fromEntries(
  VARIABLES.map(v => [v.name, v])
);

/**
 * Clamp a number between min and max.
 */
export function clamp(val, min, max) {
  if (typeof val !== 'number' || isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalize a raw value to 0..1 based on defined variable bounds.
 * Returns null if the value is null, undefined, or NaN.
 */
export function normalizeVariable(name, rawVal) {
  if (rawVal === null || rawVal === undefined || isNaN(rawVal)) {
    return null;
  }

  const def = VARIABLE_MAP[name];
  if (!def) return 0;

  let val = Number(rawVal);
  // Auto-detect if solar is in W/m² instead of kWh/m²/day (1 kWh/m²/day ≈ 41.67 W/m²)
  if (name === 'solar' && val > 30) {
    val = val / 41.67;
  }

  const norm = (val - def.min) / (def.max - def.min);
  return clamp(norm, 0, 1);
}

/**
 * Format a variable value with its exact unit for display and screen readers.
 */
export function formatValue(name, rawVal) {
  if (rawVal === null || rawVal === undefined || isNaN(rawVal)) {
    return 'unavailable';
  }

  const val = Number(rawVal);
  switch (name) {
    case 'tempC':
      return `${val > 0 ? '+' : ''}${val.toFixed(1)} °C`;
    case 'precipMm':
      return `${Math.round(val)} mm`;
    case 'solar': {
      const v = val > 30 ? val / 41.67 : val;
      return `${v.toFixed(2)} kWh/m²/day`;
    }
    case 'windMs':
      return `${val.toFixed(1)} m/s`;
    case 'humidity':
      return `${Math.round(val)}%`;
    case 'co2ppm':
      return `${val.toFixed(1)} ppm`;
    case 'globalAnomalyC':
      return `${val > 0 ? '+' : ''}${val.toFixed(2)} °C`;
    default:
      return `${val}`;
  }
}
