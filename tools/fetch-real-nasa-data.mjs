// Rebuilds the yearly data in src/regions.js from real measurements.
//
//   node tools/fetch-real-nasa-data.mjs
//
// Replaces the generated (synthetic) yearly values with:
//   - NASA POWER monthly/annual point data, per destination lat/lon,
//     https://power.larc.nasa.gov/api/temporal/monthly/point
//     (MERRA-2 reanalysis and CERES/SRB satellite products, 0.5 deg grid)
//   - NOAA GML Mauna Loa annual mean CO2 (global, well-mixed; the series NASA
//     uses on climate.nasa.gov),
//     https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv
//
// Years: 1985-2025, the last complete year. A partial 2026 is not included,
// because an annual mean of a few months would be seasonally biased.
//
// Raw responses and provenance are written to assets/data/real-nasa-annual.json.
// Values POWER reports as fill (-999) become null and the layer is silent for
// that year. Destination metadata (names, coordinates, groups) is kept as is.
//
// Note: tools/generate-global-regions.mjs writes synthetic values. Do not run
// it after this script, or the real data will be overwritten.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionsFile = path.join(root, 'src/regions.js');
const rawFile = path.join(root, 'assets/data/real-nasa-annual.json');

const START = 1985;
const END = 2025;
const YEARS = Array.from({ length: END - START + 1 }, (_, i) => START + i);

const POWER_PARAMS = ['T2M', 'PRECTOTCORR', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN', 'CLOUD_AMT', 'GWETROOT', 'AOD_55'];
// GRACE water storage comes from tools/fetch-grace.py (needs an Earthdata token).
const GRACE_FILE = path.join(root, 'assets/data/grace-annual.json');
const POWER_URL = (lat, lon) =>
  `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${POWER_PARAMS.join(',')}`
  + `&community=RE&latitude=${lat}&longitude=${lon}&start=${START}&end=${END}&format=JSON`;
const CO2_URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv';

export const SIGNALS = [
  { key: 'temperature', label: 'Temperature', field: 'T2M', source: 'NASA POWER (MERRA-2) annual mean 2 m air temperature', unit: '°C', decimals: 1, range: [-20, 35], audio: 'Melody note, A-minor pentatonic A3–E5' },
  { key: 'rain', label: 'Rain', field: 'PRECTOTCORR', source: 'NASA POWER corrected precipitation, annual total', unit: 'mm', decimals: 0, range: [0, 4000], audio: 'Raindrop rate' },
  { key: 'humidity', label: 'Humidity', field: 'RH2M', source: 'NASA POWER (MERRA-2) annual mean relative humidity at 2 m', unit: '%', decimals: 0, range: [10, 100], audio: 'Reverb depth' },
  { key: 'wind', label: 'Wind', field: 'WS2M', source: 'NASA POWER (MERRA-2) annual mean wind speed at 2 m', unit: 'm/s', decimals: 1, range: [0, 10], audio: 'Wind noise 2.5–5 kHz, right' },
  { key: 'sunlight', label: 'Sunlight', field: 'ALLSKY_SFC_SW_DWN', source: 'NASA POWER (CERES/SRB) all-sky surface solar irradiance, annual mean', unit: 'kWh/m²/day', decimals: 2, range: [1, 8], audio: 'Bell chime rate' },
  { key: 'cloud', label: 'Cloud cover', field: 'CLOUD_AMT', source: 'NASA POWER (CERES) annual mean cloud amount', unit: '%', decimals: 0, range: [0, 100], audio: 'Pad brightness and haze, left' },
  { key: 'soil', label: 'Soil moisture', field: 'GWETROOT', source: 'NASA POWER (MERRA-2) root-zone soil wetness, 0 = dry, 1 = saturated', unit: '', decimals: 2, range: [0, 1], audio: 'Sub-bass 50–100 Hz' },
  { key: 'water', label: 'Water storage', field: 'lwe_thickness', source: 'NASA JPL GRACE/GRACE-FO mascon RL06.3: all water stored on land (ice, snow, soil and groundwater) vs the 2004-2009 mean', unit: 'cm', decimals: 1, range: [-60, 40], audio: 'Sub-bass loudness' },
  { key: 'air', label: 'Air haze', field: 'AOD_55', source: 'NASA POWER (MERRA-2) aerosol optical depth at 550 nm, annual mean', unit: '', decimals: 2, range: [0, 1.2], audio: 'Muffles the melody and bells' },
  { key: 'carbon', label: 'CO₂ (global)', field: 'CO2', source: 'NOAA GML Mauna Loa annual mean CO2 (global)', unit: 'ppm', decimals: 1, range: [340, 430], audio: 'Detune 0–22 cents' }
];

// Location fixes, recorded in the provenance file:
// - amazon_basin shared a 0.5 deg grid cell with amazon_rainforest (2 km apart),
//   so both had identical data. It is the wildfire / deforestation entry, so it
//   moves to Novo Progresso, Para, in the arc of deforestation (2019 "Day of Fire").
const COORD_FIX = {
  amazon_basin: {
    lat: -7.06,
    lon: -55.42,
    name: 'Amazon Deforestation Arc',
    fullName: 'Amazon Deforestation Arc, Novo Progresso (Para, Brazil)',
    short: 'Deforestation & 2019 Day of Fire',
    note: 'Moved from -3.12,-60.02 (same grid cell as amazon_rainforest) to Novo Progresso, Para, arc of deforestation; renamed from "Amazon Basin & Pantanal".'
  }
};
// - Root-zone soil wetness is undefined over the sea. Destinations whose point
//   is an ocean cell take soil moisture from the nearest coastal land cell.
const SOIL_POINT = {
  tohoku_fukushima: { lat: 37.64, lon: 140.96, note: 'Soil moisture from the nearest land cell, Minamisoma coast, Fukushima.' },
  great_barrier_reef: { lat: -18.65, lon: 146.16, note: 'Soil moisture from the Herbert River catchment (Ingham), which drains onto the reef.' }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === tries) throw error;
      await sleep(1500 * attempt);
    }
  }
  throw new Error('unreachable');
}

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function annual(parameter, year) {
  const value = parameter?.[`${year}13`];
  return typeof value === 'number' && value > -998 ? value : null;
}

const round = (value, decimals) => (value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals);

async function main() {
  const { REGIONS, ...rest } = await import(pathToFileURL(regionsFile).href);

  console.log('CO2: NOAA Mauna Loa annual means');
  const co2Text = await (await fetchWithRetry(CO2_URL)).text();
  const co2 = {};
  for (const line of co2Text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('year')) continue;
    const [year, mean] = line.split(',');
    co2[Number(year)] = Number(mean);
  }

  const raw = {
    retrieved: new Date().toISOString(),
    years: [START, END],
    sources: {
      power: { url: POWER_URL('{lat}', '{lon}'), parameters: POWER_PARAMS, note: 'Annual value = POWER month "13" (annual mean); PRECTOTCORR mm/day x days in year gives the annual total.' },
      co2: { url: CO2_URL, note: 'Global annual mean, identical for every destination.' }
    },
    co2: Object.fromEntries(YEARS.map((y) => [y, co2[y] ?? null])),
    destinations: {}
  };

  const grace = fs.existsSync(GRACE_FILE) ? JSON.parse(fs.readFileSync(GRACE_FILE, 'utf8')) : null;
  if (grace) raw.sources.grace = { file: path.relative(root, GRACE_FILE), source: grace.source, units: grace.units, method: grace.method };
  else console.log('No assets/data/grace-annual.json: run tools/fetch-grace.py for the water storage layer.');

  const regions = [];
  for (const original of REGIONS) {
    const fix = COORD_FIX[original.id];
    const region = fix
      ? { ...original, lat: fix.lat, lon: fix.lon, ...(fix.name ? { name: fix.name, fullName: fix.fullName, short: fix.short } : {}) }
      : original;
    process.stdout.write(`POWER ${region.id} (${region.lat}, ${region.lon}) ... `);
    const json = await (await fetchWithRetry(POWER_URL(region.lat, region.lon))).json();
    const p = json.properties.parameter;
    const units = Object.fromEntries(POWER_PARAMS.map((k) => [k, json.parameters?.[k]?.units]));
    raw.destinations[region.id] = { lat: region.lat, lon: region.lon, units, annual: {}, notes: [] };
    if (fix) raw.destinations[region.id].notes.push(fix.note);

    const soilPoint = SOIL_POINT[region.id];
    if (soilPoint) {
      await sleep(400);
      const soilJson = await (await fetchWithRetry(POWER_URL(soilPoint.lat, soilPoint.lon))).json();
      p.GWETROOT = soilJson.properties.parameter.GWETROOT;
      raw.destinations[region.id].soilPoint = { lat: soilPoint.lat, lon: soilPoint.lon };
      raw.destinations[region.id].notes.push(soilPoint.note);
    }

    const years = {};
    for (const year of YEARS) {
      const rainRate = annual(p.PRECTOTCORR, year);
      const row = {
        temperature: round(annual(p.T2M, year), 2),
        rain: rainRate === null ? null : Math.round(rainRate * (isLeap(year) ? 366 : 365)),
        humidity: round(annual(p.RH2M, year), 1),
        wind: round(annual(p.WS2M, year), 2),
        sunlight: round(annual(p.ALLSKY_SFC_SW_DWN, year), 3),
        cloud: round(annual(p.CLOUD_AMT, year), 1),
        soil: round(annual(p.GWETROOT, year), 3),
        water: grace?.places?.[region.id]?.annual?.[year] ?? null,
        air: round(annual(p.AOD_55, year), 3),
        carbon: co2[year] ?? null
      };
      years[year] = row;
      raw.destinations[region.id].annual[year] = Object.fromEntries(POWER_PARAMS.map((k) => [k, annual(p[k], year)]));
    }
    const unavailable = SIGNALS.map((s) => s.key).filter((key) => YEARS.every((y) => years[y][key] === null));
    const dataNotes = raw.destinations[region.id].notes;
    regions.push({ ...region, unavailable, ...(dataNotes.length ? { dataNotes } : {}), years });
    console.log(`ok${unavailable.length ? ` (no data: ${unavailable.join(', ')})` : ''}`);
    await sleep(400); // be polite to the API
  }

  fs.writeFileSync(rawFile, JSON.stringify(raw, null, 1));

  const yearRange = { start: START, end: END, years: YEARS };
  const pairs = (rest.COMPARISON_PAIRS || [])
    .filter((pair) => pair.yearA <= END && pair.yearB <= END);

  const header = `// Generated by tools/fetch-real-nasa-data.mjs on ${raw.retrieved.slice(0, 10)}.\n`
    + '// Yearly values are real measurements: NASA POWER per destination and NOAA\n'
    + '// Mauna Loa CO2. Raw responses: assets/data/real-nasa-annual.json. Do not edit by hand.\n\n';
  const out = [
    header,
    `export const YEAR_RANGE = ${JSON.stringify(yearRange)};\n\n`,
    `export const SIGNALS = ${JSON.stringify(SIGNALS, null, 2)};\n\n`,
    `export const COUNTRIES = ${JSON.stringify(rest.COUNTRIES, null, 2)};\n\n`,
    `export const GROUPS = ${JSON.stringify(rest.GROUPS, null, 2)};\n\n`,
    `export const COMPARISON_PAIRS = ${JSON.stringify(pairs, null, 2)};\n\n`,
    `export const REGIONS = ${JSON.stringify(regions, null, 2)};\n\n`,
    'export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));\n\n',
    `export const MARKER = ${JSON.stringify(rest.MARKER, null, 2)};\n`
  ].join('');
  fs.writeFileSync(regionsFile, out);
  console.log(`\nWrote ${path.relative(root, regionsFile)} (${regions.length} destinations, ${START}-${END}) and ${path.relative(root, rawFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
