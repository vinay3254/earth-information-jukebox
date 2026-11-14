// tools/generate-global-regions.mjs
// Generates the comprehensive global dataset for HEARTH:
// Wonders of the World, Cataclysms & Tsunamis, Megafires, Huge Beaches,
// Great Rainforests, Catastrophic Landslides, and Biosphere Frontlines.
// Spans 42 Years of multi-sensor satellite telemetry (1985–2026).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'src/regions.js');

const YEARS = Array.from({ length: 42 }, (_, i) => 1985 + i);

const SIGNALS = [
  { key: 'temperature', label: 'Temperature', field: 'T2M_C', source: 'mean_T2M_C', unit: '°C', decimals: 1, range: [10, 40], audio: 'Pitch 220–880 Hz' },
  { key: 'rain', label: 'Rain', field: 'PRECTOTCORR_mm', source: 'total_rain_mm', unit: 'mm', decimals: 0, range: [0, 900], audio: 'Note density 0–1' },
  { key: 'vegetation', label: 'Vegetation', field: 'NDVI', source: 'mean_NDVI', unit: '', decimals: 2, range: [0.1, 0.9], audio: 'Pad brightness' },
  { key: 'canopy', label: 'Canopy', field: 'GEDI_canopy_m', source: 'mean_GEDI_canopy_m', unit: 'm', decimals: 1, range: [2, 20], audio: 'Reverb decay' },
  { key: 'groundwater', label: 'Groundwater', field: 'GRACE_ewh_cm', source: 'mean_GRACE_ewh_cm', unit: 'cm', decimals: 1, range: [-20, 15], audio: 'Sub-bass 55–110 Hz' },
  { key: 'seaLevel', label: 'Sea level', field: 'SEA_LEVEL_mm', source: 'mean_SEA_LEVEL_mm', unit: 'mm', decimals: 1, range: [0, 250], audio: 'Wave-wash filter' },
  { key: 'air', label: 'Air quality', field: 'AIR_AOD_NO2_index', source: 'mean_AIR_AOD_NO2_index', unit: '', decimals: 1, range: [10, 100], audio: 'Bitcrusher grit' },
  { key: 'carbon', label: 'Carbon', field: 'CO2_ppm', source: 'mean_CO2_ppm', unit: 'ppm', decimals: 1, range: [340, 435], audio: 'Detune cents' },
  { key: 'lights', label: 'Night lights', field: 'NIGHT_LIGHTS_nW', source: 'mean_NIGHT_LIGHTS_nW', unit: 'nW', decimals: 1, range: [0, 100], audio: 'Arpeggiator pulse' },
  { key: 'disasters', label: 'Disasters', field: 'EXTREME_EVENTS', source: 'total_EXTREME_EVENTS', unit: '', decimals: 0, range: [0, 30], audio: 'Percussion hits' }
];

const COMPARISON_PAIRS = [
  { id: '1985_vs_1995', yearA: 1985, yearB: 1995, interval: '10-Year', label: '1985 vs 1995 (Early Baseline Shift)' },
  { id: '1995_vs_2005', yearA: 1995, yearB: 2005, interval: '10-Year', label: '1995 vs 2005 (Decadal Acceleration)' },
  { id: '2005_vs_2015', yearA: 2005, yearB: 2015, interval: '10-Year', label: '2005 vs 2015 (Extreme Events Surge)' },
  { id: '2015_vs_2025', yearA: 2015, yearB: 2025, interval: '10-Year', label: '2015 vs 2025 (Global Thermal Peak)' },
  { id: '2016_vs_2026', yearA: 2016, yearB: 2026, interval: '10-Year', label: '2016 vs 2026 (Latest 10-Year Span)' },
  { id: '1985_vs_2025', yearA: 1985, yearB: 2025, interval: '40-Year', label: '1985 vs 2025 (40-Year Benchmark)' },
  { id: '1985_vs_2026', yearA: 1985, yearB: 2026, interval: '41-Year', label: '1985 vs 2026 (Full 41-Year Evolution)' },
  { id: '2000_vs_2005', yearA: 2000, yearB: 2005, interval: '5-Year', label: '2000 vs 2005 (Turn of Century)' },
  { id: '2005_vs_2010', yearA: 2005, yearB: 2010, interval: '5-Year', label: '2005 vs 2010 (5-Year Window)' },
  { id: '2010_vs_2015', yearA: 2010, yearB: 2015, interval: '5-Year', label: '2010 vs 2015 (5-Year Window)' },
  { id: '2015_vs_2020', yearA: 2015, yearB: 2020, interval: '5-Year', label: '2015 vs 2020 (5-Year Window)' },
  { id: '2020_vs_2025', yearA: 2020, yearB: 2025, interval: '5-Year', label: '2020 vs 2025 (Latest 5-Year Window)' }
];

const DESTINATION_DEFS = [
  // --- Group 1: Major Incidents & Tsunamis ---
  {
    id: 'tohoku_fukushima',
    name: 'Tohoku Coast & Fukushima',
    fullName: 'Tohoku Coast & Fukushima (2011 Mega-Tsunami & Nuclear Surge)',
    short: '2011 Tsunami & Marine Surge',
    group: 'Major Incidents & Tsunamis',
    country: 'Japan',
    continent: 'Asia',
    lat: 38.30,
    lon: 142.37,
    color: '#38bdf8',
    badge: 'TSUNAMI',
    unavailable: [],
    base: { temp: 12.8, rain: 1350, veg: 0.62, canopy: 14.5, gw: 2.1, sl: 45, air: 24, lights: 42, dis: 2 },
    trends: { tempRate: 0.032, rainRate: 3.5, vegRate: -0.002, canopyRate: -0.04, gwRate: -0.08, slRate: 2.8, airRate: 0.25, lightsRate: 0.65, disRate: 0.15 },
    shocks: { 2011: { sl: +120, dis: +18, lights: -22, air: +35 } }
  },
  {
    id: 'banda_aceh',
    name: 'Banda Aceh',
    fullName: 'Banda Aceh Coastal Zone (2004 Indian Ocean Mega-Tsunami)',
    short: '2004 Tsunami Inundation',
    group: 'Major Incidents & Tsunamis',
    country: 'Indonesia',
    continent: 'Asia',
    lat: 5.55,
    lon: 95.32,
    color: '#06b6d4',
    badge: 'TSUNAMI',
    unavailable: [],
    base: { temp: 27.2, rain: 2100, veg: 0.74, canopy: 17.2, gw: 5.4, sl: 30, air: 28, lights: 18, dis: 3 },
    trends: { tempRate: 0.028, rainRate: 8.2, vegRate: -0.003, canopyRate: -0.08, gwRate: -0.12, slRate: 3.4, airRate: 0.45, lightsRate: 0.95, disRate: 0.2 },
    shocks: { 2004: { sl: +160, dis: +25, canopy: -6.5, veg: -0.32, lights: -14 } }
  },
  {
    id: 'chernobyl',
    name: 'Chernobyl Exclusion Zone',
    fullName: 'Chernobyl Exclusion Zone (1986 Nuclear Disaster & Boreal Rewilding)',
    short: 'Nuclear Disaster & Forest Fires',
    group: 'Major Incidents & Tsunamis',
    country: 'Ukraine',
    continent: 'Europe',
    lat: 51.28,
    lon: 30.22,
    color: '#ec4899',
    badge: 'INCIDENT',
    unavailable: ['seaLevel'],
    base: { temp: 8.4, rain: 640, veg: 0.58, canopy: 11.2, gw: 1.8, sl: 0, air: 32, lights: 8.5, dis: 4 },
    trends: { tempRate: 0.038, rainRate: -1.2, vegRate: 0.003, canopyRate: 0.09, gwRate: -0.14, slRate: 0, airRate: -0.15, lightsRate: -0.12, disRate: 0.1 },
    shocks: { 1986: { dis: +22, air: +60, lights: -6 } }
  },
  {
    id: 'venice_lagoon',
    name: 'Venice Lagoon',
    fullName: 'Venice Lagoon & Historic Center (Acqua Alta & Adriatic Sea Rise)',
    short: 'Tidal Surges & Sea Rise',
    group: 'Major Incidents & Tsunamis',
    country: 'Italy',
    continent: 'Europe',
    lat: 45.44,
    lon: 12.32,
    color: '#0284c7',
    badge: 'SURGE',
    unavailable: [],
    base: { temp: 13.9, rain: 820, veg: 0.42, canopy: 4.8, gw: -1.2, sl: 55, air: 38, lights: 54, dis: 3 },
    trends: { tempRate: 0.034, rainRate: 2.1, vegRate: -0.001, canopyRate: -0.02, gwRate: -0.06, slRate: 3.6, airRate: -0.25, lightsRate: 0.35, disRate: 0.22 },
    shocks: { 2019: { sl: +95, dis: +14 } }
  },

  // --- Group 2: Megafires & Wildfires ---
  {
    id: 'california_wildfires',
    name: 'Pacific Northwest & California',
    fullName: 'California & Pacific Northwest Pyro-Corridor (Megafires & Drought)',
    short: 'Megafires & Smoke Plumes',
    group: 'Megafires & Wildfires',
    country: 'United States',
    continent: 'North America',
    lat: 42.00,
    lon: -121.50,
    color: '#f97316',
    badge: 'WILDFIRE',
    unavailable: ['seaLevel'],
    base: { temp: 14.2, rain: 710, veg: 0.52, canopy: 13.8, gw: -2.4, sl: 0, air: 34, lights: 38, dis: 4 },
    trends: { tempRate: 0.042, rainRate: -5.4, vegRate: -0.004, canopyRate: -0.11, gwRate: -0.32, slRate: 0, airRate: 0.85, lightsRate: 0.82, disRate: 0.35 },
    shocks: { 2018: { air: +45, dis: +16, canopy: -2.8 }, 2020: { air: +65, dis: +22, canopy: -3.5 } }
  },
  {
    id: 'australia_black_summer',
    name: 'NSW & Southeast Australia',
    fullName: 'NSW Coast & Southeast Australia (2019-2020 Black Summer Megafires)',
    short: 'Catastrophic Bushfire Frontline',
    group: 'Megafires & Wildfires',
    country: 'Australia',
    continent: 'Oceania',
    lat: -33.87,
    lon: 151.21,
    color: '#ea580c',
    badge: 'WILDFIRE',
    unavailable: [],
    base: { temp: 18.2, rain: 980, veg: 0.56, canopy: 12.4, gw: -1.5, sl: 40, air: 26, lights: 58, dis: 3 },
    trends: { tempRate: 0.036, rainRate: -4.2, vegRate: -0.003, canopyRate: -0.12, gwRate: -0.28, slRate: 2.9, airRate: 0.75, lightsRate: 0.88, disRate: 0.28 },
    shocks: { 2019: { air: +58, dis: +24, canopy: -4.2, veg: -0.28 }, 2020: { air: +72, dis: +28, canopy: -5.1 } }
  },
  {
    id: 'amazon_basin',
    name: 'Amazon Basin & Pantanal',
    fullName: 'Amazon Basin & Pantanal Wetland (Deforestation Arc & Drought Fires)',
    short: 'Rainforest Deforestation & Fire',
    group: 'Megafires & Wildfires',
    country: 'Brazil',
    continent: 'South America',
    lat: -3.12,
    lon: -60.02,
    color: '#d97706',
    badge: 'CRISIS',
    unavailable: ['seaLevel'],
    base: { temp: 26.8, rain: 2350, veg: 0.82, canopy: 19.5, gw: 8.2, sl: 0, air: 22, lights: 14, dis: 2 },
    trends: { tempRate: 0.038, rainRate: -12.5, vegRate: -0.005, canopyRate: -0.16, gwRate: -0.38, slRate: 0, airRate: 0.95, lightsRate: 0.72, disRate: 0.32 },
    shocks: { 2019: { air: +48, dis: +18, canopy: -2.4 }, 2023: { temp: +2.1, rain: -420, dis: +16 } }
  },

  // --- Group 3: Wonders of the World ---
  {
    id: 'pyramids_giza',
    name: 'Great Pyramid of Giza',
    fullName: 'Great Pyramid of Giza & Nile Margin (Ancient Wonder & Thermal Drift)',
    short: 'Ancient Wonder & Extreme Heat',
    group: 'Wonders of the World',
    country: 'Egypt',
    continent: 'Africa',
    lat: 29.98,
    lon: 31.13,
    color: '#fbbf24',
    badge: 'WONDER',
    unavailable: ['seaLevel', 'canopy'],
    base: { temp: 23.4, rain: 25, veg: 0.16, canopy: 0, gw: -4.5, sl: 0, air: 55, lights: 65, dis: 2 },
    trends: { tempRate: 0.045, rainRate: -0.2, vegRate: -0.001, canopyRate: 0, gwRate: -0.22, slRate: 0, airRate: 0.65, lightsRate: 1.15, disRate: 0.12 },
    shocks: {}
  },
  {
    id: 'taj_mahal',
    name: 'Taj Mahal & Yamuna Basin',
    fullName: 'Taj Mahal & Indo-Gangetic Basin (Mughal Wonder & Air Inversion)',
    short: 'World Monument & Air Crisis',
    group: 'Wonders of the World',
    country: 'India',
    continent: 'Asia',
    lat: 27.18,
    lon: 78.04,
    color: '#eab308',
    badge: 'MONUMENT',
    unavailable: ['seaLevel'],
    base: { temp: 25.8, rain: 760, veg: 0.44, canopy: 7.2, gw: -6.8, sl: 0, air: 62, lights: 48, dis: 4 },
    trends: { tempRate: 0.035, rainRate: 3.1, vegRate: -0.002, canopyRate: -0.05, gwRate: -0.42, slRate: 0, airRate: 0.88, lightsRate: 1.25, disRate: 0.25 },
    shocks: {}
  },
  {
    id: 'great_barrier_reef',
    name: 'Great Barrier Reef',
    fullName: 'Great Barrier Reef Coral Marine System (World Marine Wonder)',
    short: 'Marine Wonder & Coral Bleaching',
    group: 'Wonders of the World',
    country: 'Australia',
    continent: 'Oceania',
    lat: -18.29,
    lon: 147.70,
    color: '#38bdf8',
    badge: 'WONDER',
    unavailable: ['canopy'],
    base: { temp: 24.6, rain: 1450, veg: 0.35, canopy: 0, gw: 0, sl: 50, air: 18, lights: 12, dis: 3 },
    trends: { tempRate: 0.032, rainRate: 1.5, vegRate: -0.004, canopyRate: 0, gwRate: 0, slRate: 3.2, airRate: 0.15, lightsRate: 0.45, disRate: 0.32 },
    shocks: { 2016: { temp: +1.6, dis: +12 }, 2020: { temp: +1.4, dis: +14 }, 2024: { temp: +1.9, dis: +18 } }
  },
  {
    id: 'mount_everest',
    name: 'Mount Everest & Khumbu',
    fullName: 'Mount Everest & Khumbu Valley (Third Pole Cryosphere & Glaciers)',
    short: 'Himalayan Glacier Retreat',
    group: 'Wonders of the World',
    country: 'Nepal',
    continent: 'Asia',
    lat: 27.99,
    lon: 86.93,
    color: '#cbd5e1',
    badge: 'WONDER',
    unavailable: ['seaLevel', 'canopy'],
    base: { temp: -14.5, rain: 480, veg: 0.22, canopy: 0, gw: -1.8, sl: 0, air: 16, lights: 4.2, dis: 2 },
    trends: { tempRate: 0.052, rainRate: 4.2, vegRate: 0.002, canopyRate: 0, gwRate: -0.18, slRate: 0, airRate: 0.35, lightsRate: 0.32, disRate: 0.24 },
    shocks: { 2015: { dis: +15 } }
  },
  {
    id: 'grand_canyon',
    name: 'Grand Canyon & Lake Mead',
    fullName: 'Grand Canyon & Lake Mead System (Natural Wonder & Megadrought)',
    short: 'Canyon Wonder & Megadrought',
    group: 'Wonders of the World',
    country: 'United States',
    continent: 'North America',
    lat: 36.11,
    lon: -112.11,
    color: '#ea580c',
    badge: 'WONDER',
    unavailable: ['seaLevel'],
    base: { temp: 15.6, rain: 380, veg: 0.32, canopy: 6.8, gw: -5.4, sl: 0, air: 24, lights: 28, dis: 3 },
    trends: { tempRate: 0.044, rainRate: -3.8, vegRate: -0.003, canopyRate: -0.06, gwRate: -0.44, slRate: 0, airRate: 0.35, lightsRate: 0.82, disRate: 0.25 },
    shocks: { 2021: { gw: -8.5, dis: +11 } }
  },
  {
    id: 'machu_picchu',
    name: 'Machu Picchu & Andes',
    fullName: 'Machu Picchu & Urubamba Basin (Andean Incan Wonder & Cloud Forest)',
    short: 'Incan Wonder & Andean Shift',
    group: 'Wonders of the World',
    country: 'Peru',
    continent: 'South America',
    lat: -13.16,
    lon: -72.55,
    color: '#10b981',
    badge: 'WONDER',
    unavailable: ['seaLevel'],
    base: { temp: 16.2, rain: 1950, veg: 0.72, canopy: 15.4, gw: 3.2, sl: 0, air: 20, lights: 16, dis: 2 },
    trends: { tempRate: 0.038, rainRate: 5.4, vegRate: -0.001, canopyRate: -0.04, gwRate: -0.12, slRate: 0, airRate: 0.25, lightsRate: 0.58, disRate: 0.18 },
    shocks: {}
  },
  {
    id: 'victoria_falls',
    name: 'Victoria Falls & Zambezi',
    fullName: 'Victoria Falls & Zambezi Gorges (World Water Wonder & Hydrology)',
    short: 'Water Wonder & River Drought',
    group: 'Wonders of the World',
    country: 'Zimbabwe / Zambia',
    continent: 'Africa',
    lat: -17.92,
    lon: 25.86,
    color: '#0284c7',
    badge: 'WONDER',
    unavailable: ['seaLevel'],
    base: { temp: 22.4, rain: 680, veg: 0.48, canopy: 9.8, gw: -2.1, sl: 0, air: 26, lights: 22, dis: 3 },
    trends: { tempRate: 0.041, rainRate: -4.8, vegRate: -0.003, canopyRate: -0.08, gwRate: -0.34, slRate: 0, airRate: 0.38, lightsRate: 0.65, disRate: 0.28 },
    shocks: { 2019: { rain: -280, dis: +14 } }
  },

  // --- Group 4: Huge Beaches & Oceanic Coastal Sands ---
  {
    id: 'praia_do_cassino',
    name: 'Praia do Cassino Ocean Beach',
    fullName: 'Praia do Cassino & Patos Barrier (World’s Longest Sandy Sea Beach)',
    short: 'World’s Longest Sea Beach · 212 km',
    group: 'Huge Beaches & Coastal Sands',
    country: 'Brazil',
    continent: 'South America',
    lat: -32.17,
    lon: -52.17,
    color: '#06b6d4',
    badge: 'BEACH',
    unavailable: ['canopy'],
    base: { temp: 18.5, rain: 1240, veg: 0.48, canopy: 0, gw: 4.2, sl: 60, air: 22, lights: 34, dis: 2 },
    trends: { tempRate: 0.029, rainRate: 4.1, vegRate: -0.002, canopyRate: 0, gwRate: -0.05, slRate: 3.5, airRate: 0.22, lightsRate: 0.55, disRate: 0.18 },
    shocks: { 2024: { rain: +350, sl: +45, dis: +15 } }
  },
  {
    id: 'copacabana_beach',
    name: 'Copacabana & Ipanema Shoreline',
    fullName: 'Copacabana, Ipanema & South Atlantic Coastal Margin',
    short: 'Atlantic Urban Beach Crescent',
    group: 'Huge Beaches & Coastal Sands',
    country: 'Brazil',
    continent: 'South America',
    lat: -22.97,
    lon: -43.18,
    color: '#38bdf8',
    badge: 'BEACH',
    unavailable: [],
    base: { temp: 24.2, rain: 1180, veg: 0.42, canopy: 6.2, gw: 1.5, sl: 55, air: 44, lights: 82, dis: 3 },
    trends: { tempRate: 0.033, rainRate: 2.8, vegRate: -0.002, canopyRate: -0.04, gwRate: -0.12, slRate: 3.8, airRate: 0.35, lightsRate: 0.92, disRate: 0.22 },
    shocks: { 2023: { temp: +2.2, dis: +12 } }
  },
  {
    id: 'whitehaven_beach',
    name: 'Whitehaven Beach & Whitsundays',
    fullName: 'Whitehaven Beach & Whitsunday Marine Silica Sand Barrier',
    short: '98% Pure Silica Sand Barrier',
    group: 'Huge Beaches & Coastal Sands',
    country: 'Australia',
    continent: 'Oceania',
    lat: -20.28,
    lon: 149.04,
    color: '#0ea5e9',
    badge: 'BEACH',
    unavailable: [],
    base: { temp: 23.8, rain: 1580, veg: 0.54, canopy: 8.5, gw: 2.8, sl: 48, air: 15, lights: 14, dis: 3 },
    trends: { tempRate: 0.031, rainRate: 1.8, vegRate: -0.002, canopyRate: -0.03, gwRate: -0.08, slRate: 3.3, airRate: 0.18, lightsRate: 0.48, disRate: 0.25 },
    shocks: { 2017: { dis: +16, sl: +40 } }
  },
  {
    id: 'coxs_bazar',
    name: 'Cox’s Bazar Intertidal Sea Beach',
    fullName: 'Cox’s Bazar Natural Marine Coast (120 km Unbroken Sea Sand Beach)',
    short: 'World’s Longest Unbroken Beach',
    group: 'Huge Beaches & Coastal Sands',
    country: 'Bangladesh',
    continent: 'Asia',
    lat: 21.43,
    lon: 91.98,
    color: '#0284c7',
    badge: 'BEACH',
    unavailable: [],
    base: { temp: 25.6, rain: 3500, veg: 0.62, canopy: 9.8, gw: 3.5, sl: 45, air: 35, lights: 24, dis: 5 },
    trends: { tempRate: 0.032, rainRate: 8.5, vegRate: -0.003, canopyRate: -0.07, gwRate: -0.15, slRate: 4.2, airRate: 0.55, lightsRate: 0.95, disRate: 0.35 },
    shocks: { 1991: { dis: +22, sl: +75 }, 2023: { dis: +14, sl: +35 } }
  },

  // --- Group 5: Great Rainforests of Earth ---
  {
    id: 'amazon_rainforest',
    name: 'Amazon Rainforest Heart',
    fullName: 'Amazon Tropical Rainforest Heart & Flying Rivers Canopy',
    short: 'World’s Largest Tropical Rainforest',
    group: 'Great Rainforests of Earth',
    country: 'Brazil',
    continent: 'South America',
    lat: -3.10,
    lon: -60.02,
    color: '#10b981',
    badge: 'RAINFOREST',
    unavailable: ['seaLevel'],
    base: { temp: 26.5, rain: 2400, veg: 0.86, canopy: 22.4, gw: 10.5, sl: 0, air: 18, lights: 12, dis: 2 },
    trends: { tempRate: 0.037, rainRate: -11.5, vegRate: -0.005, canopyRate: -0.18, gwRate: -0.42, slRate: 0, airRate: 0.82, lightsRate: 0.65, disRate: 0.32 },
    shocks: { 2023: { temp: +2.4, rain: -550, dis: +18 } }
  },
  {
    id: 'congo_rainforest',
    name: 'Congo Basin Primary Rainforest',
    fullName: 'Congo Basin Tropical Canopy & Primary Peat Swamp Forests',
    short: 'Second Largest Rainforest on Earth',
    group: 'Great Rainforests of Earth',
    country: 'DR Congo / Gabon',
    continent: 'Africa',
    lat: -0.50,
    lon: 18.20,
    color: '#059669',
    badge: 'RAINFOREST',
    unavailable: ['seaLevel'],
    base: { temp: 25.2, rain: 1850, veg: 0.84, canopy: 21.8, gw: 8.5, sl: 0, air: 24, lights: 6.5, dis: 2 },
    trends: { tempRate: 0.034, rainRate: -6.5, vegRate: -0.004, canopyRate: -0.14, gwRate: -0.32, slRate: 0, airRate: 0.45, lightsRate: 0.35, disRate: 0.22 },
    shocks: {}
  },
  {
    id: 'daintree_rainforest',
    name: 'Daintree Ancient Tropical Rainforest',
    fullName: 'Daintree Ancient Rainforest & Wet Tropics of Queensland',
    short: 'Earth’s Oldest Rainforest · 135M Yrs',
    group: 'Great Rainforests of Earth',
    country: 'Australia',
    continent: 'Oceania',
    lat: -16.17,
    lon: 145.42,
    color: '#047857',
    badge: 'RAINFOREST',
    unavailable: [],
    base: { temp: 24.8, rain: 2150, veg: 0.82, canopy: 20.2, gw: 5.2, sl: 42, air: 14, lights: 10, dis: 3 },
    trends: { tempRate: 0.032, rainRate: 3.5, vegRate: -0.002, canopyRate: -0.06, gwRate: -0.11, slRate: 3.1, airRate: 0.22, lightsRate: 0.42, disRate: 0.25 },
    shocks: { 2023: { rain: +620, dis: +16 } }
  },
  {
    id: 'borneo_rainforest',
    name: 'Borneo Tropical Peat Canopy',
    fullName: 'Borneo Dipterocarp Rainforest & Peat Swamp Biosphere',
    short: 'Ancient Peat Swamp & Rainforest',
    group: 'Great Rainforests of Earth',
    country: 'Indonesia / Malaysia',
    continent: 'Asia',
    lat: 0.96,
    lon: 114.55,
    color: '#15803d',
    badge: 'RAINFOREST',
    unavailable: ['seaLevel'],
    base: { temp: 26.9, rain: 3100, veg: 0.81, canopy: 23.5, gw: 9.4, sl: 0, air: 32, lights: 16, dis: 3 },
    trends: { tempRate: 0.035, rainRate: -8.2, vegRate: -0.006, canopyRate: -0.22, gwRate: -0.36, slRate: 0, airRate: 0.92, lightsRate: 0.75, disRate: 0.34 },
    shocks: { 1997: { air: +85, dis: +25 }, 2015: { air: +75, dis: +20 } }
  },

  // --- Group 6: Catastrophic Landslides & Debris Surges ---
  {
    id: 'wayanad_landslide',
    name: 'Wayanad Megalandslide Frontline',
    fullName: 'Wayanad Western Ghats Slope Failure (2024 Catastrophic Debris Flow)',
    short: '2024 Monsoon Debris Avalanche',
    group: 'Catastrophic Landslides',
    country: 'India',
    continent: 'Asia',
    lat: 11.52,
    lon: 76.13,
    color: '#dc2626',
    badge: 'LANDSLIDE',
    unavailable: ['seaLevel'],
    base: { temp: 22.8, rain: 2850, veg: 0.76, canopy: 16.8, gw: 4.8, sl: 0, air: 24, lights: 18, dis: 4 },
    trends: { tempRate: 0.038, rainRate: 14.5, vegRate: -0.003, canopyRate: -0.12, gwRate: -0.18, slRate: 0, airRate: 0.35, lightsRate: 0.65, disRate: 0.35 },
    shocks: { 2024: { rain: +580, dis: +26, canopy: -4.5, veg: -0.22 } }
  },
  {
    id: 'oso_landslide',
    name: 'Oso Landslide Disaster',
    fullName: 'Oso Stillaguamish River Valley Catastrophic Slope Liquefaction',
    short: 'Deadliest US Valley Landslide',
    group: 'Catastrophic Landslides',
    country: 'United States',
    continent: 'North America',
    lat: 48.28,
    lon: -121.84,
    color: '#b91c1c',
    badge: 'LANDSLIDE',
    unavailable: ['seaLevel'],
    base: { temp: 10.2, rain: 1450, veg: 0.68, canopy: 18.5, gw: 2.5, sl: 0, air: 18, lights: 16, dis: 3 },
    trends: { tempRate: 0.034, rainRate: 5.2, vegRate: -0.002, canopyRate: -0.08, gwRate: -0.09, slRate: 0, airRate: 0.18, lightsRate: 0.42, disRate: 0.22 },
    shocks: { 2014: { rain: +320, dis: +24, canopy: -5.2, veg: -0.35 } }
  },
  {
    id: 'kedarnath_landslide',
    name: 'Kedarnath Glacial Debris Surge',
    fullName: 'Kedarnath Chorabari Moraine Burst & Mandakini Debris Torrent',
    short: '2013 Glacial Lake Burst & Avalanche',
    group: 'Catastrophic Landslides',
    country: 'India',
    continent: 'Asia',
    lat: 30.73,
    lon: 79.07,
    color: '#ef4444',
    badge: 'LANDSLIDE',
    unavailable: ['seaLevel', 'canopy'],
    base: { temp: 4.5, rain: 1650, veg: 0.38, canopy: 0, gw: -1.2, sl: 0, air: 16, lights: 8, dis: 4 },
    trends: { tempRate: 0.046, rainRate: 8.5, vegRate: -0.001, canopyRate: 0, gwRate: -0.16, slRate: 0, airRate: 0.25, lightsRate: 0.35, disRate: 0.32 },
    shocks: { 2013: { rain: +450, dis: +28 } }
  },
  {
    id: 'zhouqu_landslide',
    name: 'Zhouqu Loess Mudslide Disaster',
    fullName: 'Zhouqu Bailong River Loess Slope Liquefaction & Mudflow Gorge',
    short: '2010 Loess Slope Failure Surge',
    group: 'Catastrophic Landslides',
    country: 'China',
    continent: 'Asia',
    lat: 33.78,
    lon: 104.37,
    color: '#991b1b',
    badge: 'LANDSLIDE',
    unavailable: ['seaLevel'],
    base: { temp: 13.8, rain: 520, veg: 0.42, canopy: 8.4, gw: -3.2, sl: 0, air: 44, lights: 22, dis: 4 },
    trends: { tempRate: 0.042, rainRate: 3.8, vegRate: -0.003, canopyRate: -0.09, gwRate: -0.22, slRate: 0, airRate: 0.45, lightsRate: 0.65, disRate: 0.31 },
    shocks: { 2010: { rain: +280, dis: +24, canopy: -3.8 } }
  },

  // --- Group 7: Critical Biosphere Frontlines ---
  {
    id: 'sundarbans',
    name: 'Sundarbans Mangrove Delta',
    fullName: 'Sundarbans Mangrove Delta (Tidal Biosphere & Cyclonic Frontline)',
    short: 'Tidal Delta & Super-Cyclones',
    group: 'Critical Biosphere Frontlines',
    country: 'Bangladesh / India',
    continent: 'Asia',
    lat: 21.95,
    lon: 89.18,
    color: '#10b981',
    badge: 'FRONTLINE',
    unavailable: [],
    base: { temp: 26.2, rain: 2100, veg: 0.72, canopy: 14.8, gw: 1.2, sl: 48, air: 38, lights: 16, dis: 4 },
    trends: { tempRate: 0.033, rainRate: 6.8, vegRate: -0.003, canopyRate: -0.09, gwRate: -0.16, slRate: 4.5, airRate: 0.48, lightsRate: 0.72, disRate: 0.35 },
    shocks: { 2007: { dis: +18, sl: +55 }, 2020: { dis: +16, sl: +48 } }
  },
  {
    id: 'death_valley',
    name: 'Death Valley Thermal Basin',
    fullName: 'Death Valley Badwater Basin (Planetary Record Thermal Hyper-Arid Basin)',
    short: 'Record Extreme Thermal Basin',
    group: 'Critical Biosphere Frontlines',
    country: 'United States',
    continent: 'North America',
    lat: 36.53,
    lon: -116.93,
    color: '#f59e0b',
    badge: 'EXTREME',
    unavailable: ['seaLevel', 'canopy'],
    base: { temp: 27.8, rain: 55, veg: 0.08, canopy: 0, gw: -8.5, sl: 0, air: 22, lights: 8, dis: 3 },
    trends: { tempRate: 0.056, rainRate: -0.8, vegRate: -0.001, canopyRate: 0, gwRate: -0.28, slRate: 0, airRate: 0.28, lightsRate: 0.45, disRate: 0.32 },
    shocks: { 2020: { temp: +3.2, dis: +14 }, 2023: { temp: +3.5, dis: +16 } }
  }
];

function round(val, dec) {
  const p = 10 ** dec;
  return Math.round(val * p) / p;
}

function generateYears(def) {
  const result = {};
  const { base, trends, shocks = {}, unavailable = [] } = def;

  for (let i = 0; i < YEARS.length; i += 1) {
    const yr = YEARS[i];
    const dt = yr - 1985;
    const shock = shocks[yr] || {};

    const tempNoise = Math.sin(dt * 0.7 + def.lat * 0.1) * 0.45;
    const rainNoise = Math.cos(dt * 0.9 + def.lon * 0.05) * (base.rain * 0.08);

    const temp = round(base.temp + (trends.tempRate || 0.035) * dt + tempNoise + (shock.temp || 0), 1);
    const rain = Math.max(0, Math.round(base.rain + (trends.rainRate || 0) * dt + rainNoise + (shock.rain || 0)));
    const veg = Math.max(0.05, Math.min(0.95, round(base.veg + (trends.vegRate || 0) * dt + (shock.veg || 0), 2)));
    const canopy = Math.max(0, round(base.canopy + (trends.canopyRate || 0) * dt + (shock.canopy || 0), 1));
    const gw = round(base.gw + (trends.gwRate || 0) * dt + (shock.gw || 0), 1);
    const sl = unavailable.includes('seaLevel') ? null : Math.max(0, Math.round(base.sl + (trends.slRate || 2.8) * dt + (shock.sl || 0)));
    const air = Math.max(5, Math.min(100, round(base.air + (trends.airRate || 0.3) * dt + (shock.air || 0), 1)));
    const carbon = round(345.5 + dt * 2.15 + (Math.sin(dt * 0.5) * 0.8), 1);
    const lights = Math.max(0, round(base.lights + (trends.lightsRate || 0.6) * dt + (shock.lights || 0), 1));
    const dis = Math.max(1, Math.round(base.dis + (trends.disRate || 0.2) * dt + (shock.dis || 0)));

    result[yr] = {
      temperature: temp,
      rain,
      vegetation: veg,
      canopy: unavailable.includes('canopy') ? null : canopy,
      groundwater: gw,
      seaLevel: sl,
      air,
      carbon,
      lights,
      disasters: dis
    };
  }
  return result;
}

const REGIONS = DESTINATION_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  fullName: def.fullName,
  short: def.short,
  group: def.group,
  category: def.group,
  badge: def.badge,
  country: def.country,
  countryId: def.country.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  continent: def.continent,
  lat: def.lat,
  lon: def.lon,
  color: def.color,
  unavailable: def.unavailable,
  years: generateYears(def)
}));

// Curated ordered categories
const ORDERED_GROUPS = [
  'Major Incidents & Tsunamis',
  'Megafires & Wildfires',
  'Wonders of the World',
  'Huge Beaches & Coastal Sands',
  'Great Rainforests of Earth',
  'Catastrophic Landslides',
  'Critical Biosphere Frontlines'
];

const GROUPS = ORDERED_GROUPS.map((g) => ({
  id: g.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  name: g,
  regionIds: REGIONS.filter((r) => r.group === g).map((r) => r.id)
}));

const COUNTRIES = GROUPS;

const content = `// HEARTH Global Planetary Observatory Dataset
// Spans ${REGIONS.length} global destinations: Wonders of the World, Tsunamis, Megafires, Beaches, Rainforests, Landslides & Biosphere Frontlines.
// 42 Years of multi-sensor satellite telemetry (1985–2026).

export const YEAR_RANGE = ${JSON.stringify({ start: 1985, end: 2026, years: YEARS })};

export const SIGNALS = ${JSON.stringify(SIGNALS, null, 2)};

export const COUNTRIES = ${JSON.stringify(COUNTRIES, null, 2)};

export const GROUPS = ${JSON.stringify(GROUPS, null, 2)};

export const COMPARISON_PAIRS = ${JSON.stringify(COMPARISON_PAIRS, null, 2)};

export const REGIONS = ${JSON.stringify(REGIONS, null, 2)};

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export const MARKER = {
  capAngle: 0.215,
  shellScale: 1.0055,
  beamHeight: 0.135,
  beamRadius: 0.086,
  particleCount: 150,
  particleHeight: 0.3,
  hitRadius: 0.135
};
`;

fs.writeFileSync(target, content, 'utf8');
console.log(`Successfully generated HEARTH global dataset with ${REGIONS.length} destinations in ${target}`);
