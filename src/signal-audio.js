// Web Audio engine for HEARTH Planetary Geospatial Sonification Observatory.
// Spans 28 planetary destinations: authentic spatial environment audio soundscapes
// paired with harmonic layers driven by real yearly data (NASA POWER per place,
// NOAA Mauna Loa CO2), 1985-2025.
//
// Music: a slow i-VI-III-VII pad progression in each place's key (from its mean
// temperature), a soft melody whose centre note follows the yearly temperature
// change, and chord-tone drops and chimes.
//
// Mix layout (frequency band / stereo position), so layers do not mask each other:
//   soil -> sub-bass 50-100 Hz, centre      temperature -> melody A3-E5, centre
//   cloud -> pad 110-330 Hz (+ haze 0.7-1.5 kHz, left)
//   rain -> drops 440-880 Hz, random pan    sunlight -> chimes 880-1760 Hz, random pan
//   wind -> noise 2.5-5 kHz, right          humidity -> reverb depth, CO2 -> detune
//
// Zero buzzing synth presets: pure harmonic sine/triangle ambient pads,
// crystalline glass-harp pentatonic arpeggiations, soft water droplets,
// deep subterranean sub-bass, and real CC0 spatial environmental recordings.

import { SIGNALS, REGIONS } from './regions.js';

const PENTATONIC = [0, 3, 5, 7, 10, 12];
// Melody notes for temperature: A-minor pentatonic from A3 to E5.
const LEAD_SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19];
const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

// Psychoacoustic helpers. Loudness is heard on a log scale, so levels are set
// in decibels; pitch and brightness are heard as ratios, so frequencies sweep
// geometrically rather than linearly.
const db = (decibels) => Math.pow(10, decibels / 20);
const dbRange = (n, lowDb, highDb) => db(lowDb + (highDb - lowDb) * n);
const logMap = (n, low, high) => low * Math.pow(high / low, clamp01(n));

// Scaling: each value is compared with the place's own 1985-2000 baseline,
// z = (v - mean) / sd, then n = 1 / (1 + e^(-z / ANOMALY_SCALE)), so a typical
// year sits near 0.5 and unusual years move away from it. CO2 rises smoothly
// everywhere, so it uses the place's 1985-2025 span instead.
const BASELINE = [1985, 2000];
const ANOMALY_SCALE = 1.5;
const SPAN_KEYS = new Set(['carbon']);

// Character: where the value sits among Earth's climates, so a cold dry place
// and a hot wet place sound different. Ranges cover the 28 destinations; rain
// spans two orders of magnitude, so it is compared on a log scale.
const ABSOLUTE = {
  temperature: { range: [-5, 30] },
  rain: { range: [30, 4500], log: true },
  humidity: { range: [20, 90] },
  wind: { range: [0, 7] },
  sunlight: { range: [3, 7] },
  cloud: { range: [20, 90] },
  soil: { range: [0.2, 1] }
};
// n = CHARACTER_WEIGHT * character + (1 - CHARACTER_WEIGHT) * change
const CHARACTER_WEIGHT = 0.6;

function absoluteNorm(key, value) {
  const spec = ABSOLUTE[key];
  if (!spec) return null;
  const [a, b] = spec.range;
  if (spec.log) return clamp01(Math.log(Math.max(value, a) / a) / Math.log(b / a));
  return clamp01((value - a) / (b - a));
}

// Each place plays in its own key, set by its long-term mean temperature:
// colder places sit lower and darker, hotter places higher. Six distinct keys
// (E, F#, G#, A, B, C#) within -5..+4 semitones of A, so no two climate bands
// share a key and the melody stays below ~830 Hz.
const KEY_OFFSETS = [-5, -3, -1, 0, 2, 4];
const PAD_BASE = [110, 164.81, 220, 329.63];

// Slow progression in the place's key, i - VI - III - VII (Am F C G when the
// key is A). Voicings are semitones above A2 (110 Hz) for the four pad voices.
const CHORDS = [
  [0, 7, 12, 19], // Am: A2 E3 A3 E4
  [-4, 3, 8, 12], // F:  F2 C3 F3 A3
  [3, 10, 15, 19], // C:  C3 G3 C4 E4
  [-2, 5, 10, 14] // G:  G2 D3 G3 B3
];
const CHORD_SECONDS = 9;
// Climate profiles. Listeners tell sounds apart by instrument, speed and how
// busy they are, far more than by key, so each climate type gets its own
// instrument, tempo, rhythm and background texture. The data still drives
// pitch, density, brightness and levels inside each profile.
export const CLIMATES = {
  desert: { label: 'Desert', bpm: 56, gaps: [2, 2, 3], melody: 'pluck', rainScale: 0.4, padLevel: 0.32, reverbScale: 0.45, texture: 'wind' },
  rainforest: { label: 'Tropical rainforest', bpm: 112, gaps: [0.5, 0.5, 1, 1], melody: 'marimba', rainScale: 1.8, padLevel: 0.6, reverbScale: 1.3, texture: 'insects' },
  cold: { label: 'Cold and mountain', bpm: 46, gaps: [2, 3, 4], melody: 'glass', rainScale: 0.5, padLevel: 0.42, reverbScale: 1.5, texture: 'wind' },
  coast: { label: 'Coast and ocean', bpm: 72, gaps: [1, 1.5, 2], melody: 'flute', rainScale: 1, padLevel: 0.5, reverbScale: 1.1, texture: 'waves' },
  temperate: { label: 'Temperate and seasonal', bpm: 84, gaps: [1, 1, 1.5, 2], melody: 'keys', rainScale: 1, padLevel: 0.55, reverbScale: 1, texture: null }
};
// Coastal and ocean sites (location, not climate data).
const COASTAL = new Set(['tohoku_fukushima', 'banda_aceh', 'venice_lagoon', 'great_barrier_reef', 'praia_do_cassino', 'copacabana_beach', 'whitehaven_beach', 'coxs_bazar', 'sundarbans']);

// Classified from the place's own 1985-2025 averages, in this order:
// desert = mean rain < 350 mm; cold = mean temperature < 10 C; coast = on the
// sea; rainforest = >= 22 C and >= 1750 mm; everything else is temperate.
export function climateOf(region) {
  if (!region) return 'temperate';
  const rows = Object.values(region.years || {});
  const mean = (key) => {
    const v = rows.map((row) => Number(row?.[key])).filter(Number.isFinite);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  const temp = mean('temperature');
  const rain = mean('rain');
  if (rain < 350) return 'desert';
  if (temp < 10) return 'cold';
  if (COASTAL.has(region.id)) return 'coast';
  if (temp >= 22 && rain >= 1750) return 'rainforest';
  return 'temperate';
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const pitchClass = (semitones) => ((semitones % 12) + 12) % 12;

// Random arrivals at rate lambda per second (a Poisson process): the gap is
// exponential, -ln(1 - U) / lambda. A small floor keeps two events from
// landing on top of each other.
const poissonGap = (lambda) => Math.max(0.08, -Math.log(1 - Math.random()) / lambda);

function makeNoiseBuffer(ctx, seconds = 3) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeImpulse(ctx, seconds = 3.2, decay = 2.4) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// Full 28-destination dedicated spatial environmental soundscape mapping
export function soundscapeOrigin(file) {
  return /\.wav$/i.test(file || '') ? 'synthesized soundscape' : 'field recording';
}

export const REGION_ENVIRONMENT_AUDIO = Object.freeze({
  // --- Major Incidents & Tsunamis ---
  tohoku_fukushima: { file: 'fukushima-tsunami.wav', name: 'Pacific Tsunami Surge, Concrete Seawall & Warning Bell', volume: 0.7 },
  banda_aceh: { file: 'banda-aceh-surf.wav', name: 'Indian Ocean Breakers & Tropical Rebuilt Shoreline', volume: 0.7 },
  chernobyl: { file: 'chernobyl-ruins.wav', name: 'Pripyat Exclusion Zone Whistling Ruins & Geiger Clicks', volume: 0.65 },
  venice_lagoon: { file: 'venice-canal.wav', name: 'Venetian Canal Water Lap & Distant Church Bell', volume: 0.68 },

  // --- Megafires & Wildfires ---
  california_wildfires: { file: 'wildfire-loop.ogg', name: 'Sierra Pine Forest Crown Fire & Timber Blaze', volume: 0.75 },
  australia_black_summer: { file: 'wildfire-loop.ogg', name: 'Black Summer Eucalyptus Bushfire Frontline & Ember Roar', volume: 0.75 },
  amazon_basin: { file: 'wildfire-loop.ogg', name: 'Amazon Basin Deforestation Arc Burning Timber & Smoke', volume: 0.72 },

  // --- Wonders of the World ---
  pyramids_giza: { file: 'giza-desert-wind.wav', name: 'Giza Plateau Sahara Desert Wind & Limestone Corridors', volume: 0.65 },
  taj_mahal: { file: 'taj-sitar-yaman.ogg', name: 'Yamuna Riverbank & Sacred Sitar Raga Yaman', volume: 0.68 },
  great_barrier_reef: { file: 'barrier-reef-marine.wav', name: 'Coral Sea Reef Lagoon Hydrophone & Tropical Swell', volume: 0.68 },
  mount_everest: { file: 'everest-howling-wind.ogg', name: 'Himalayan Khumbu Ridge & 8000m Alpine Blizzard Gale', volume: 0.7 },
  grand_canyon: { file: 'grand-canyon-echo.wav', name: 'Colorado River Gorge Cavernous Red-Rock Echoes', volume: 0.65 },
  machu_picchu: { file: 'machu-picchu-andes.wav', name: 'Andean Mountain Peak Mist & Sacred Quena Flute', volume: 0.65 },
  victoria_falls: { file: 'victoria-waterfall.ogg', name: 'Mosi-oa-Tunya Cataract Roar & White Water Deluge', volume: 0.72 },

  // --- Huge Beaches & Oceanic Coastal Sands ---
  praia_do_cassino: { file: 'praia-cassino-roar.wav', name: '240km South Atlantic Endless Rolling Ocean Roar', volume: 0.75 },
  coxs_bazar: { file: 'ocean-loop.ogg', name: 'Bay of Bengal 120km Intertidal Surf & Coastal Gale', volume: 0.75 },
  copacabana_beach: { file: 'ocean-loop.ogg', name: 'Copacabana Atlantic Shoreline Waves & Surf Breakers', volume: 0.72 },
  whitehaven_beach: { file: 'whitehaven-silica.wav', name: 'Whitsunday Coral Sand Shore & Gentle Silica Lap', volume: 0.65 },

  // --- Ancient & Lush Rainforests ---
  amazon_rainforest: { file: 'rainforest-loop.ogg', name: 'Amazon Primary Rainforest Canopy Wildlife & Rain', volume: 0.75 },
  congo_rainforest: { file: 'congo-jungle-night.wav', name: 'Congo Basin Primary Rainforest Night Insect Choir & Drip', volume: 0.72 },
  daintree_rainforest: { file: 'forest-birds.ogg', name: 'Daintree Ancient Tropical Rainforest Canopy & Creek', volume: 0.7 },
  borneo_rainforest: { file: 'borneo-swamp-chorus.wav', name: 'Borneo Tropical Peat Swamp & Treefrog Choir', volume: 0.72 },

  // --- Catastrophic Landslides & Mountain Disasters ---
  wayanad_landslide: { file: 'wayanad-landslide.wav', name: 'Western Ghats Monsoon Cloudburst & Mountain Torrent', volume: 0.72 },
  oso_landslide: { file: 'rain-thunder.ogg', name: 'Pacific Northwest River Valley Downpour & Thunder', volume: 0.7 },
  kedarnath_landslide: { file: 'kedarnath-debris.wav', name: 'Mandakini Valley Glacial Flood & Roaring River Rapids', volume: 0.72 },
  zhouqu_landslide: { file: 'wayanad-landslide.wav', name: 'Bailong River Mountain Canyon Mud Torrent & Deluge', volume: 0.7 },

  // --- Critical Biosphere Frontlines ---
  death_valley: { file: 'death-valley-heat.wav', name: 'Badwater Basin Shimmering Thermal Arid Drafts', volume: 0.62 },
  sundarbans: { file: 'sundarbans-mangrove.wav', name: 'Sundarbans Mangrove Tidal Estuary Swirl & Delta Breeze', volume: 0.68 }
});

export class SignalAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.initPromise = null;
    this.region = null;
    this.year = null;
    this.enabled = new Set(SIGNALS.map((signal) => signal.key));
    this.norms = {};
    this.rates = { rain: 0.4, lights: 2, disasters: 0.1 };
    this.nextRain = 0;
    this.nextLights = 0;
    this.nextHit = 0;
    this.lightsStep = 0;
    this.chordIndex = 0;
    this.nextChord = 0;
    this.nextMelody = 0;
    this.melodyTarget = null;
    this.melodyStep = null;
    this.userGain = null;
    this.analyser = null;
    this.muted = false;
    this.volume = 1;
    this.onStateChange = null;
    this.failureStatus = null;
    this.playRequested = false;
    this.hasPlayed = false;
    this.hasRun = false;

    // Spatial environmental soundscape state
    this.envAudioCache = new Map();
    this.currentEnvFile = null;
    this.currentEnvSource = null;
    this.currentEnvGain = null;
    this.activeSoundscapeName = '';
  }

  get state() {
    let status;
    if (this.failureStatus) status = this.failureStatus;
    else if (!(window.AudioContext || window.webkitAudioContext) || this.ctx?.state === 'closed') status = 'unavailable';
    else if (!this.ready) status = 'idle';
    else if (this.ctx.state !== 'running') status = this.hasRun ? 'paused' : 'blocked';
    else if (this.playRequested && this.region) status = 'playing';
    else status = this.hasPlayed && this.region ? 'paused' : 'ready';
    return {
      status,
      muted: this.muted,
      volume: this.volume,
      soundscape: this.activeSoundscapeName
    };
  }

  emitState() {
    this.onStateChange?.(this.state);
  }

  applyUserGain() {
    if (!this.userGain || this.ctx?.state === 'closed') return;
    const gain = this.userGain.gain;
    gain.cancelScheduledValues(this.now);
    // The music dips to 35% while the voice guide speaks, so words stay clear.
    gain.setTargetAtTime(this.muted ? 0 : this.volume * (this.voiceDuck ? 0.35 : 1), this.now, 0.12);
  }

  setVoiceDuck(on) {
    this.voiceDuck = Boolean(on);
    this.applyUserGain();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyUserGain();
    this.emitState();
  }

  setVolume(volume) {
    if (!Number.isFinite(Number(volume))) return;
    this.volume = clamp01(Number(volume));
    this.applyUserGain();
    this.emitState();
  }

  async init() {
    if (this.ready) return this.ctx;
    try {
      this.failureStatus = null;
      const ctx = this.buildGraph();
      this.emitState();
      return ctx;
    } catch (error) {
      const ctx = this.ctx;
      this.ctx = null;
      this.ready = false;
      this.userGain = null;
    this.analyser = null;
      this.hasRun = false;
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
      this.failureStatus = error.name === 'NotAllowedError' ? 'blocked' : 'unavailable';
      this.emitState();
      throw error;
    }
  }

  buildGraph() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available');
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.hasRun = ctx.state === 'running';
    ctx.addEventListener('statechange', () => {
      if (this.ctx !== ctx) return;
      if (ctx.state === 'running') {
        this.hasRun = true;
        this.failureStatus = null;
      }
      this.emitState();
    });

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    // Music passes through a duck stage so the trend sweep can sit on top.
    const musicDuck = ctx.createGain();
    master.connect(musicDuck);
    musicDuck.connect(compressor);
    this.musicDuck = musicDuck;
    this.compressor = compressor;

    const userGain = ctx.createGain();
    userGain.gain.value = this.muted ? 0 : this.volume;
    compressor.connect(userGain);
    userGain.connect(ctx.destination);
    this.userGain = userGain;
    this.master = master;

    // Real-time audio analyser for frequency & wave HUD
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    userGain.connect(analyser);
    this.analyser = analyser;

    // Shared lush convolution reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.05;
    convolver.connect(reverbWet);
    reverbWet.connect(master);
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.65;
    reverbSend.connect(convolver);
    this.reverb = convolver;
    this.reverbWet = reverbWet;
    this.reverbSend = reverbSend;

    // Melody notes (temperature) get their own bus so the layer toggle mutes them.
    this.melodyBus = ctx.createGain();
    this.melodyBus.gain.value = 0;
    this.melodyBus.connect(master);
    this.melodyBus.connect(reverbSend);

    // Climate textures (levels set per profile in apply()).
    const texNoise = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer || makeNoiseBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      src.start();
      return g;
    };
    // Wind floor: soft high-mid noise, slightly right.
    this.windFloor = texNoise('bandpass', 1800, 0.6);
    const windFloorPan = ctx.createStereoPanner();
    windFloorPan.pan.value = 0.3;
    this.windFloor.connect(windFloorPan);
    windFloorPan.connect(master);
    // Insects: a 6 kHz band trembling at 17 Hz.
    this.insectGain = texNoise('bandpass', 6200, 4);
    const insectTrem = ctx.createGain();
    insectTrem.gain.value = 0.5;
    const insectLfo = ctx.createOscillator();
    insectLfo.frequency.value = 17;
    const insectDepth = ctx.createGain();
    insectDepth.gain.value = 0.5;
    insectLfo.connect(insectDepth);
    insectDepth.connect(insectTrem.gain);
    insectLfo.start();
    this.insectGain.connect(insectTrem);
    insectTrem.connect(master);
    // Waves: low noise that swells and recedes about every 9 s, left.
    this.waveGain = texNoise('lowpass', 520, 0.5);
    const waveSwell = ctx.createGain();
    waveSwell.gain.value = 0.5;
    const waveLfo = ctx.createOscillator();
    waveLfo.frequency.value = 0.11;
    const waveDepth = ctx.createGain();
    waveDepth.gain.value = 0.5;
    waveLfo.connect(waveDepth);
    waveDepth.connect(waveSwell.gain);
    waveLfo.start();
    const wavePan = ctx.createStereoPanner();
    wavePan.pan.value = -0.35;
    this.waveGain.connect(waveSwell);
    waveSwell.connect(wavePan);
    wavePan.connect(master);
    wavePan.connect(reverbSend);

    // Dedicated bus for spatial environmental ambient recordings
    const envBus = ctx.createGain();
    // Recordings sit under the data layers so the sonification stays audible.
    envBus.gain.value = 0.45;
    envBus.connect(master);
    envBus.connect(reverbSend);
    this.envBus = envBus;

    this.noiseBuffer = makeNoiseBuffer(ctx);

    // Vegetation: Warm, lush cinematic ambient pad (pure harmonic sines + triangle)
    // NO harsh sawtooth oscillators
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.Q.value = 0.5;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain);
    padGain.connect(master);
    padGain.connect(reverbSend);
    this.padFilter = padFilter;
    this.padGain = padGain;

    const padVoice = (type, freq, gainValue) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(padFilter);
      osc.start();
      return osc;
    };
    this.padVoices = [
      padVoice('sine', 110, 0.045),         // Warm A2 fundamental
      padVoice('triangle', 164.81, 0.022),   // Soft E3 perfect fifth
      padVoice('sine', 220, 0.038),          // Velvet A3 octave
      padVoice('sine', 329.63, 0.014)        // Ethereal E4 celestial sheen
    ];

    // Temperature: Gentle celestial sine lead with slow chorused drift
    // NO harsh triangle buzzer with fast vibrato
    const lead = ctx.createOscillator();
    lead.type = 'sine';
    lead.frequency.value = 220;
    const leadFilter = ctx.createBiquadFilter();
    leadFilter.type = 'lowpass';
    leadFilter.frequency.value = 850;
    leadFilter.Q.value = 0.5;
    const leadGain = ctx.createGain();
    leadGain.gain.value = 0;
    lead.connect(leadFilter);
    leadFilter.connect(leadGain);
    leadGain.connect(master);
    leadGain.connect(reverbSend);
    lead.start();
    this.lead = lead;
    this.leadGain = leadGain;

    // Slow, serene chorusing drift (0.65 Hz)
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 0.65;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 2.5;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(lead.detune);
    vibrato.start();
    this.vibrato = vibrato;

    // Groundwater: Sub-bass warmth (55-82 Hz)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    const subGain = ctx.createGain();
    subGain.gain.value = 0;
    sub.connect(subGain);
    subGain.connect(master);
    sub.start();
    this.sub = sub;
    this.subGain = subGain;

    // Sea level: Gentle wave wash with soft lowpass
    const sea = ctx.createBufferSource();
    sea.buffer = this.noiseBuffer;
    sea.loop = true;
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'bandpass';
    seaFilter.frequency.value = 350;
    seaFilter.Q.value = 0.8;
    const seaGain = ctx.createGain();
    seaGain.gain.value = 0;
    sea.connect(seaFilter);
    seaFilter.connect(seaGain);
    const hazePan = ctx.createStereoPanner();
    hazePan.pan.value = -0.4;
    seaGain.connect(hazePan);
    hazePan.connect(master);
    seaGain.connect(reverbSend);
    sea.start();
    this.seaFilter = seaFilter;
    this.seaGain = seaGain;

    const seaLfo = ctx.createOscillator();
    seaLfo.type = 'sine';
    seaLfo.frequency.value = 0.12;
    const seaLfoDepth = ctx.createGain();
    seaLfoDepth.gain.value = 120;
    seaLfo.connect(seaLfoDepth);
    seaLfoDepth.connect(seaFilter.frequency);
    seaLfo.start();
    this.seaLfo = seaLfo;

    // Air quality: Silky breath of wind (NO clipping distortion waveshaper)
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 1100;
    airFilter.Q.value = 0.7;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    air.connect(airFilter);
    airFilter.connect(airGain);
    const windPan = ctx.createStereoPanner();
    windPan.pan.value = 0.45;
    airGain.connect(windPan);
    windPan.connect(master);
    airGain.connect(reverbSend);
    air.start();
    this.airFilter = airFilter;
    this.airGain = airGain;

    // Rhythmic buses
    this.rainBus = ctx.createGain();
    this.rainBus.gain.value = 0;
    this.rainBus.connect(master);
    this.rainBus.connect(reverbSend);

    this.lightsBus = ctx.createGain();
    this.lightsBus.gain.value = 0;
    this.lightsBus.connect(master);
    this.lightsBus.connect(reverbSend);

    this.hitBus = ctx.createGain();
    this.hitBus.gain.value = 0;
    this.hitBus.connect(master);
    this.hitBus.connect(reverbSend);

    this.ready = true;
    const now = ctx.currentTime;
    this.nextRain = now + 0.1;
    this.nextLights = now + 0.2;
    this.nextHit = now + 0.4;
    this.apply(now);
    return ctx;
  }

  async fetchAndDecodeAudio(filename) {
    if (this.envAudioCache.has(filename)) {
      return this.envAudioCache.get(filename);
    }
    const response = await fetch(`./assets/audio/${filename}`);
    if (!response.ok) throw new Error(`Audio load failed: ${response.status} ${filename}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.envAudioCache.set(filename, audioBuffer);
    return audioBuffer;
  }

  async playEnvironmentForRegion(region) {
    if (!region || !this.ready || this.ctx.state === 'closed') return;
    const meta = REGION_ENVIRONMENT_AUDIO[region.id] || {
      file: 'mountain-wind-loop.ogg',
      name: 'Planetary Surface Ambient Atmosphere',
      volume: 0.6
    };

    // Say honestly what the place sound is: the .ogg files are recordings
    // from Wikimedia Commons, the .wav files are generated by
    // tools/generate-spatial-soundscapes.mjs.
    this.activeSoundscapeOrigin = soundscapeOrigin(meta.file);
    this.activeSoundscapeName = `${meta.name} (${this.activeSoundscapeOrigin})`;
    this.emitState();

    if (this.currentEnvFile === meta.file && this.currentEnvSource) {
      // Already running the correct soundscape
      return;
    }

    const now = this.now;

    // Crossfade out previous track
    if (this.currentEnvGain && this.currentEnvSource) {
      const oldGain = this.currentEnvGain;
      const oldSource = this.currentEnvSource;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      setTimeout(() => {
        try { oldSource.stop(); } catch {}
      }, 900);
      this.currentEnvSource = null;
      this.currentEnvGain = null;
    }

    try {
      const buffer = await this.fetchAndDecodeAudio(meta.file);
      if (!this.ready || this.ctx.state === 'closed') return;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(meta.volume, now + 1.2);

      source.connect(gain);
      gain.connect(this.envBus);
      source.start(now);

      this.currentEnvSource = source;
      this.currentEnvGain = gain;
      this.currentEnvFile = meta.file;
    } catch (err) {
      console.warn('Could not start spatial environment soundscape:', err);
    }
  }

  stopEnvironment() {
    if (this.currentEnvGain && this.currentEnvSource) {
      const now = this.now;
      const oldGain = this.currentEnvGain;
      const oldSource = this.currentEnvSource;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      setTimeout(() => {
        try { oldSource.stop(); } catch {}
      }, 700);
      this.currentEnvSource = null;
      this.currentEnvGain = null;
      this.currentEnvFile = null;
    }
  }

  async start() {
    if (!this.initPromise) {
      this.initPromise = this.init().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    await this.initPromise;
    await this.resume();
    return this.ctx;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setDestination(region) {
    // A new place starts clean: its textures, key and pad snap in at once
    // instead of the previous place's sound fading over it, and the chord and
    // melody restart from the home chord.
    if ((region?.id || null) !== (this.region?.id || null)) {
      this.snapNext = true;
      this.chordIndex = 0;
      this.melodyStep = null;
      this.melodyHistory = [];
      this.lastRecords = null;
      if (this.ready) {
        this.nextChord = this.now + CHORD_SECONDS;
        this.nextMelody = this.now + 0.3;
      }
    }
    this.region = region || null;
    if (!region) {
      this.playRequested = false;
      this.stopEnvironment();
    } else {
      this.playEnvironmentForRegion(region);
    }
    this.setYear(this.year);
    this.emitState();
  }

  setYear(year) {
    this.year = Number(year);
    this.readValues();
    this.records = this.recordsFor(this.year);
    if (this.ready) {
      this.apply(this.now);
      this.markRecords();
    }
  }

  // Which records this year sets at this place: hottest, driest or wettest
  // across 1985-2025.
  recordsFor(year) {
    const rows = Object.values(this.region?.years || {});
    const row = this.region?.years?.[year];
    if (!row) return {};
    const isMax = (key) => row[key] != null && rows.every((r) => r[key] == null || r[key] <= row[key]);
    const isMin = (key) => row[key] != null && rows.every((r) => r[key] == null || r[key] >= row[key]);
    return { hottest: isMax('temperature'), driest: isMin('rain'), wettest: isMax('rain') };
  }

  // Extremes you cannot miss: a rising shimmer for the record-hottest year, a
  // soft falling figure for the record-driest (whose rain also goes almost
  // silent in apply()). Played once when such a year is reached.
  markRecords() {
    const r = this.records || {};
    const key = `${this.region?.id}:${this.year}`;
    if (this.lastRecords === key || !(r.hottest || r.driest) || this.ctx?.state !== 'running') return;
    this.lastRecords = key;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.15;
    const k = this.keyRatio || 1;
    const note = (freq, at, len, level, type = 'sine') => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(level, at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g);
      g.connect(this.compressor);
      g.connect(this.reverbSend);
      osc.start(at);
      osc.stop(at + len + 0.05);
    };
    if (r.hottest) {
      // Rising shimmer: root, fifth, octave, tenth, quickly upward.
      [0, 7, 12, 16].forEach((semi, i) => note(440 * k * Math.pow(2, semi / 12), t + i * 0.09, 1.2, 0.07, 'triangle'));
    }
    if (r.driest) {
      // Falling two-note figure, low and hollow.
      note(330 * k, t + (r.hottest ? 0.6 : 0), 0.9, 0.08);
      note(220 * k, t + (r.hottest ? 1.0 : 0.4), 1.4, 0.08);
    }
  }

  // Compare by ear: the same four-note phrase for each year, placed left for
  // year A and right for year B, so only the data differs between them.
  playComparePhrase(pan = 0) {
    if (!this.ready || !this.region || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.1;
    const center = this.melodyTarget ?? 4;
    const steps = [center - 2, center, center + 1, center].map((i) => Math.max(0, Math.min(LEAD_SCALE.length - 1, i)));
    const rain = this.norms?.rain ?? 0.5;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.compressor);
    panner.connect(this.reverbSend);
    steps.forEach((step, i) => {
      const at = t0 + i * 0.32;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 * this.melodyKeyRatio() * Math.pow(2, LEAD_SCALE[step] / 12), at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.09, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      osc.connect(g);
      g.connect(panner);
      osc.start(at);
      osc.stop(at + 0.55);
    });
    // Rain density for that year as quick ticks under the phrase.
    const drops = Math.round(1 + rain * 7);
    for (let i = 0; i < drops; i++) {
      const at = t0 + 0.05 + (i / drops) * 1.2;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(this.chordToneHz(880), at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.03, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(g);
      g.connect(panner);
      osc.start(at);
      osc.stop(at + 0.15);
    }
  }

  setComparing(on) {
    this.comparing = Boolean(on);
    if (this.ready) this.melodyBus.gain.setTargetAtTime(this.comparing ? 0.25 : 1, this.now, 0.2);
  }

  setEnabled(key, on) {
    if (on) this.enabled.add(key);
    else this.enabled.delete(key);
    if (this.ready) this.apply(this.now);
  }

  setEnabledSet(keys) {
    this.enabled = new Set(keys);
    if (this.ready) this.apply(this.now);
  }

  isAvailable(key) {
    if (!this.region) return false;
    if (Array.isArray(this.region.unavailable) && this.region.unavailable.includes(key)) return false;
    return true;
  }

  stats(region, key) {
    if (!this.statsCache) this.statsCache = new WeakMap();
    let cache = this.statsCache.get(region);
    if (!cache) {
      cache = {};
      this.statsCache.set(region, cache);
    }
    if (!(key in cache)) {
      const all = [];
      const base = [];
      for (const [year, row] of Object.entries(region.years || {})) {
        const value = Number(row?.[key]);
        if (row?.[key] === null || !Number.isFinite(value)) continue;
        all.push(value);
        if (Number(year) >= BASELINE[0] && Number(year) <= BASELINE[1]) base.push(value);
      }
      if (!all.length) {
        cache[key] = null;
      } else {
        const ref = base.length >= 5 ? base : all;
        const mean = ref.reduce((a, b) => a + b, 0) / ref.length;
        const sd = Math.sqrt(ref.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, ref.length - 1));
        cache[key] = { mean, sd, min: Math.min(...all), max: Math.max(...all) };
      }
    }
    return cache[key];
  }

  // Semitone offset for the current place: places are ranked by their
  // 1985-2025 mean temperature and split into six equal groups, coldest group
  // lowest key, so every key is used by a similar number of places.
  placeTranspose() {
    if (!this.region) return 0;
    if (!this.keyByRegion) {
      const meanTemp = (region) => {
        const values = Object.values(region.years || {}).map((row) => Number(row?.temperature)).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      };
      const ranked = [...REGIONS].sort((x, y) => meanTemp(x) - meanTemp(y));
      this.keyByRegion = new Map(ranked.map((region, i) => [
        region.id,
        KEY_OFFSETS[Math.min(KEY_OFFSETS.length - 1, Math.floor((i / ranked.length) * KEY_OFFSETS.length))]
      ]));
    }
    return this.keyByRegion.get(this.region.id) ?? 0;
  }

  readValues() {
    const norms = {};
    this.keyRatio = Math.pow(2, this.placeTranspose() / 12);
    this.climate = climateOf(this.region);
    this.changes = {};
    for (const signal of SIGNALS) {
      const row = this.region && this.isAvailable(signal.key) ? this.region.years[this.year] : null;
      const raw = row ? row[signal.key] : null;
      const stats = raw === null || raw === undefined ? null : this.stats(this.region, signal.key);
      if (!stats || !Number.isFinite(Number(raw))) {
        norms[signal.key] = null;
        continue;
      }
      const value = Number(raw);
      const span = stats.max - stats.min;
      if (SPAN_KEYS.has(signal.key)) {
        norms[signal.key] = span > 1e-9 ? clamp01((value - stats.min) / span) : 0.5;
        continue;
      }
      const change = stats.sd < 1e-9 ? 0.5 : 1 / (1 + Math.exp(-((value - stats.mean) / stats.sd) / ANOMALY_SCALE));
      this.changes[signal.key] = change;
      const character = absoluteNorm(signal.key, value);
      norms[signal.key] = character === null ? change : clamp01(CHARACTER_WEIGHT * character + (1 - CHARACTER_WEIGHT) * change);
    }
    this.norms = norms;
  }

  apply(now = this.now) {
    if (!this.ready) return;
    const n = this.norms;
    const on = (key) => this.enabled.has(key) && n[key] !== null && n[key] !== undefined;
    // ~1 s glides: a year change evolves rather than switching. A new place
    // snaps in at once so nothing of the previous place hangs over it.
    const snap = this.snapNext;
    this.snapNext = false;
    const glide = snap ? 0.02 : 0.33;
    const key = this.keyRatio || 1;

    // The place's key moves the whole harmony (pad voices keep their chord).
    this.setPadChord(now, snap ? 0.02 : 0.8);

    // Temperature -> melody note, snapped to A-minor pentatonic (A3-E5) so it
    // always agrees with the pad.
    const temp = on('temperature') ? n.temperature : null;
    if (temp !== null) {
      // The place's key already carries how hot it is; the note within the key
      // follows the year-to-year change, so warming years climb the scale.
      const change = this.changes?.temperature ?? temp;
      const step = LEAD_SCALE[Math.round(change * (LEAD_SCALE.length - 1))];
      this.lead.frequency.setTargetAtTime(220 * this.melodyKeyRatio() * Math.pow(2, step / 12), now, glide);
    }
    // The held tone becomes a quiet guide drone; the melody notes carry the tune.
    this.leadGain.gain.setTargetAtTime(temp === null ? 0 : db(-36), now, glide);
    this.melodyTarget = temp === null ? null : Math.round((this.changes?.temperature ?? temp) * (LEAD_SCALE.length - 1));
    this.melodyBus.gain.setTargetAtTime(temp === null ? 0 : this.comparing ? 0.25 : 1, now, 0.2);

    // Cloud cover -> pad brightness (clear sky = bright, log-scaled cutoff
    // 350-2400 Hz) and a soft haze band (700-1500 Hz) panned left.
    const cloud = on('cloud') ? n.cloud : null;
    this.padFilter.frequency.setTargetAtTime(logMap(cloud === null ? 0.5 : 1 - cloud, 350, 2400), now, glide);
    const profile = this.profile();
    this.padGain.gain.setTargetAtTime(cloud === null ? 0 : profile.padLevel, now, glide);
    this.seaFilter.frequency.setTargetAtTime(logMap(cloud ?? 0, 700, 1500), now, glide);
    this.seaGain.gain.setTargetAtTime(cloud === null ? 0 : dbRange(cloud, -44, -26), now, glide);

    // Soil moisture -> sub-bass 50-100 Hz, -30 to -18 dB.
    const soil = on('soil') ? n.soil : null;
    this.sub.frequency.setTargetAtTime(logMap(soil ?? 0, 50, 100), now, glide);
    this.subGain.gain.setTargetAtTime(soil === null ? 0 : dbRange(soil, -30, -18), now, glide);

    // Wind -> high wind noise 2.5-5 kHz panned right, -46 to -26 dB.
    const wind = on('wind') ? n.wind : null;
    this.airFilter.frequency.setTargetAtTime(logMap(wind ?? 0, 2500, 5000), now, glide);
    this.airGain.gain.setTargetAtTime(wind === null ? 0 : dbRange(wind, -46, -26), now, glide);

    // Humidity -> reverb depth (damp air, wetter space).
    const humidity = on('humidity') ? n.humidity : null;
    this.reverbWet.gain.setTargetAtTime(Math.min(0.75, (humidity === null ? 0.05 : 0.06 + humidity * 0.5) * profile.reverbScale), now, 0.5);

    // Climate texture: a steady wind floor (desert, cold), an insect shimmer
    // (rainforest) or a slow surf swell (coast). Only while a place is active.
    const tex = this.region ? profile.texture : null;
    // On a place change the value is SET, not glided: any later glide then
    // starts from the new place's level, so nothing of the old place lingers.
    const move = (param, value, tau) => {
      if (snap) {
        param.cancelScheduledValues(now);
        param.setValueAtTime(value, now);
      } else {
        param.setTargetAtTime(value, now, tau);
      }
    };
    move(this.windFloor.gain, tex === 'wind' ? db(this.climate === 'cold' ? -32 : -36) : 0, 1);
    move(this.insectGain.gain, tex === 'insects' ? db(-40) : 0, 1);
    move(this.waveGain.gain, tex === 'waves' ? db(-30) : 0, 1);

    // CO2 (global) -> detune of pad and melody, 0-22 cents.
    const carbon = on('carbon') ? n.carbon : null;
    const cents = carbon === null ? 0 : carbon * 22;
    for (const voice of this.padVoices) voice.detune.setTargetAtTime(cents, now, 0.5);
    this.lead.detune.setTargetAtTime(cents, now, 0.5);

    // Event layers, as random (Poisson) arrivals per second:
    // rain drops up to ~2.3/s, sunlight chimes up to ~1/s.
    // Record-driest year: the rain almost stops. Record-wettest: it pours.
    const recordRain = this.records?.driest ? 0.12 : this.records?.wettest ? 1.6 : 1;
    this.rates.rain = on('rain') ? (0.1 + n.rain * 2.2) * profile.rainScale * recordRain : 0;
    this.rates.lights = on('sunlight') ? 0.08 + n.sunlight * 0.9 : 0;
    this.rates.disasters = 0;

    this.rainBus.gain.setTargetAtTime(on('rain') ? 0.55 : 0, now, 0.2);
    this.lightsBus.gain.setTargetAtTime(on('sunlight') ? 0.45 : 0, now, 0.2);
    this.hitBus.gain.setTargetAtTime(0, now, 0.2);
  }

  melodyKeyRatio() {
    return this.keyRatio || 1;
  }

  currentChord() {
    return CHORDS[this.chordIndex % CHORDS.length];
  }

  setPadChord(now, glide) {
    const key = this.keyRatio || 1;
    this.currentChord().forEach((semis, i) => {
      const param = this.padVoices[i]?.frequency;
      if (!param) return;
      const value = 110 * key * Math.pow(2, semis / 12);
      if (glide <= 0.02) {
        param.cancelScheduledValues(now);
        param.setValueAtTime(value, now);
      } else {
        param.setTargetAtTime(value, now, glide);
      }
    });
  }

  // A chord tone of the current chord, in the octave above `base` Hz.
  chordToneHz(base) {
    const semis = pitchClass(pick(this.currentChord()));
    return base * (this.keyRatio || 1) * Math.pow(2, semis / 12);
  }

  // Next melody step: a small move around the temperature target, preferring
  // notes that belong to the chord being held.
  nextMelodyStep() {
    const target = this.melodyTarget ?? 4;
    const from = this.melodyStep ?? target;
    const chordPCs = new Set(this.currentChord().map(pitchClass));
    const recent = this.melodyHistory || [];
    const candidates = [];
    for (let i = Math.max(0, target - 3); i <= Math.min(LEAD_SCALE.length - 1, target + 3); i++) {
      let weight = 1 / (1 + Math.abs(i - from)) + 1.2 / (1 + Math.abs(i - target));
      if (chordPCs.has(pitchClass(LEAD_SCALE[i]))) weight *= 2.2;
      // Never the same note three times running.
      if (recent.length >= 2 && recent[0] === i && recent[1] === i) weight = 0;
      candidates.push([i, weight]);
    }
    let roll = Math.random() * candidates.reduce((a, [, w]) => a + w, 0);
    for (const [i, w] of candidates) {
      roll -= w;
      if (roll <= 0) return i;
    }
    return target;
  }

  // Soft plucked-flute note: sine body with a quiet octave, slow attack, long tail.
  profile() {
    return CLIMATES[this.climate] || CLIMATES.temperate;
  }

  // One melody note in the climate's instrument:
  //   pluck (desert)  - bright attack, quick fade, like an oud
  //   marimba (rainforest) - wooden strike with a 4x partial, short
  //   glass (cold)    - bell with inharmonic partials, long ring
  //   flute (coast)   - soft attack with vibrato
  //   keys (temperate) - warm electric-piano tone
  spawnMelody(time) {
    const ctx = this.ctx;
    const step = this.nextMelodyStep();
    this.melodyStep = step;
    this.melodyHistory = [step, ...(this.melodyHistory || [])].slice(0, 2);
    const freq = 220 * this.melodyKeyRatio() * Math.pow(2, LEAD_SCALE[step] / 12);
    const accent = Math.random() < 0.25 ? 1.25 : 1;
    const kind = this.profile().melody;
    const voice = {
      pluck: { partials: [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.15]], attack: 0.004, decay: 0.7, level: -22, cutoff: 3000 },
      marimba: { partials: [[1, 'sine', 1], [4, 'sine', 0.22], [10, 'sine', 0.05]], attack: 0.003, decay: 0.5, level: -22, cutoff: 5000 },
      glass: { partials: [[1, 'sine', 1], [2.76, 'sine', 0.3], [5.4, 'sine', 0.12]], attack: 0.01, decay: 3.2, level: -25, cutoff: 6000 },
      flute: { partials: [[1, 'sine', 1], [2, 'sine', 0.12]], attack: 0.12, decay: 1.6, level: -24, cutoff: 2400, vibrato: true },
      keys: { partials: [[1, 'sine', 1], [2, 'triangle', 0.18]], attack: 0.06, decay: 1.9, level: -24, cutoff: 2200 }
    }[kind];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(db(voice.level) * accent, time + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.decay);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.cutoff, time);
    filter.connect(gain);
    let vibrato = null;
    if (voice.vibrato) {
      vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5;
      const depth = ctx.createGain();
      depth.gain.value = 7; // cents
      vibrato.connect(depth);
      vibrato.start(time);
      vibrato.stop(time + voice.decay + 0.05);
      vibrato.depth = depth;
    }
    for (const [ratio, type, level] of voice.partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * ratio, time);
      osc.detune.setValueAtTime(this.lead.detune.value, time);
      if (vibrato) vibrato.depth.connect(osc.detune);
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(filter);
      osc.start(time);
      osc.stop(time + voice.decay + 0.05);
    }
    gain.connect(this.melodyBus);
  }

  // Trend sweep: the place's 41 yearly temperatures as one quick run of notes,
  // 1985 on the left to 2025 on the right, pitch from the place's own coldest
  // (low) to warmest (high) year, so a warming place is heard as a climb.
  // The record-warm year gets a brighter note. The music dips underneath.
  playTrendSweep(seconds = 2.6) {
    if (!this.ready || !this.region || this.ctx.state !== 'running') return 0;
    const years = Object.keys(this.region.years).map(Number).sort((a, b) => a - b);
    const temps = years.map((y) => Number(this.region.years[y]?.temperature));
    const valid = temps.filter(Number.isFinite);
    if (valid.length < 2) return 0;
    const lo = Math.min(...valid);
    const hi = Math.max(...valid);
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.25;
    const step = seconds / years.length;
    this.musicDuck.gain.cancelScheduledValues(ctx.currentTime);
    this.musicDuck.gain.setTargetAtTime(0.22, ctx.currentTime, 0.08);
    this.musicDuck.gain.setTargetAtTime(1, t0 + seconds + 0.3, 0.4);
    temps.forEach((temp, i) => {
      if (!Number.isFinite(temp)) return;
      const n = hi - lo > 1e-9 ? (temp - lo) / (hi - lo) : 0.5;
      const time = t0 + i * step;
      const record = temp === hi;
      const osc = ctx.createOscillator();
      osc.type = record ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(330 * Math.pow(2, 1.5 * n), time); // 330-933 Hz
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(record ? 0.16 : 0.09, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.09, step * 1.6) + (record ? 0.25 : 0));
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.8 + 1.6 * (i / (years.length - 1)), time);
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(this.compressor);
      osc.start(time);
      osc.stop(time + step * 1.6 + 0.4);
    });
    this.sweptRegion = this.region.id;
    return seconds + 0.6;
  }

  async togglePlay() {
    const { status } = this.state;
    if (status === 'unavailable') return;
    if (status === 'playing') {
      this.playRequested = false;
      await this.suspend();
      return;
    }
    if (!this.region) return;
    try {
      await this.start();
      if (!this.region || this.state.status === 'unavailable') return;
      this.fadeIn(0.6);
    } catch (error) {
      console.warn('Audio unavailable', error);
      this.emitState();
    }
  }

  fadeIn(seconds = 1.6) {
    if (this.region && this.sweptRegion !== this.region.id) {
      const region = this.region.id;
      window.setTimeout(() => {
        if (this.region?.id === region && this.ctx?.state === 'running') this.playTrendSweep();
      }, 900);
    }
    if (this.ready && this.ctx.state !== 'closed' && this.region) {
      const now = this.now;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.exponentialRampToValueAtTime(0.85, now + seconds);
      this.playRequested = true;
      this.hasPlayed = true;
      this.playEnvironmentForRegion(this.region);
    }
    this.emitState();
  }

  fadeOut(seconds = 0.8) {
    this.playRequested = false;
    if (this.ready && this.ctx.state !== 'closed') {
      const now = this.now;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      this.stopEnvironment();
    }
    this.emitState();
  }

  async suspend() {
    try {
      if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
    } finally {
      this.emitState();
    }
  }

  async resume() {
    if (!this.ready) return this.start();
    const ctx = this.ctx;
    try {
      if (!ctx || ctx.state === 'closed') throw new Error('Audio context is closed');
      if (ctx.state !== 'running') await ctx.resume();
      if (this.ctx !== ctx) return;
      if (ctx.state !== 'running') throw new Error('Audio is blocked; try again from a user gesture');
      this.hasRun = true;
      this.failureStatus = null;
      if (this.region) this.playEnvironmentForRegion(this.region);
      this.emitState();
      return ctx;
    } catch (error) {
      if (this.ctx === ctx) {
        this.failureStatus = ctx && ctx.state !== 'closed' ? 'blocked' : 'unavailable';
        this.emitState();
      }
      throw error;
    }
  }

  update() {
    if (!this.ready) return;
    const now = this.now;

    // Chord progression
    if (this.nextChord < now - 1) this.nextChord = now + CHORD_SECONDS;
    if (now >= this.nextChord) {
      this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      this.setPadChord(now, 1.5);
      this.nextChord += CHORD_SECONDS;
    }

    // Melody notes
    if (this.melodyTarget !== null) {
      if (this.nextMelody < now - 0.4) this.nextMelody = now + 0.1;
      let guard = 0;
      while (this.nextMelody < now + 0.12 && guard < 3) {
        this.spawnMelody(this.nextMelody);
        const profile = this.profile();
        this.nextMelody += (60 / profile.bpm) * pick(profile.gaps);
        guard += 1;
      }
    }

    // Rain: Gentle water droplet plucks
    if (this.rates.rain > 0) {
      if (this.nextRain < now - 0.4) this.nextRain = now + 0.02;
      let guard = 0;
      while (this.nextRain < now + 0.12 && guard < 6) {
        this.spawnPluck(this.nextRain);
        this.nextRain += poissonGap(this.rates.rain);
        guard += 1;
      }
    } else {
      this.nextRain = now + 0.25;
    }

    // Night lights: Delicate glass celesta / bell chime (pure sine)
    if (this.rates.lights > 0) {
      if (this.nextLights < now - 0.4) this.nextLights = now + 0.02;
      let guard = 0;
      while (this.nextLights < now + 0.12 && guard < 8) {
        this.spawnArp(this.nextLights);
        this.nextLights += poissonGap(this.rates.lights);
        guard += 1;
      }
    } else {
      this.nextLights = now + 0.25;
    }

    // Disasters: Deep resonance and atmospheric percussion
    if (this.rates.disasters > 0) {
      if (this.nextHit < now - 0.4) this.nextHit = now + 0.05;
      let guard = 0;
      while (this.nextHit < now + 0.12 && guard < 2) {
        this.spawnHit(this.nextHit);
        this.nextHit += (0.8 + Math.random() * 1.0) / this.rates.disasters;
        guard += 1;
      }
    } else {
      this.nextHit = now + 0.35;
    }
  }

  // Soft warm water droplet pluck with organic downward fluid pitch bend
  spawnPluck(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    // Drops use a tone of the current chord, above the melody (440-880 Hz).
    const baseFreq = this.chordToneHz(this.climate === 'cold' ? 1320 : 440);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.25, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.028, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

    // Each drop lands at a random point across the stereo field.
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.random() * 1.2 - 0.6, time);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.rainBus);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  // Crystalline glass celesta bell chime in middle octave (pure musical tone)
  spawnArp(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Sunlight chimes: A-minor pentatonic around A5, the top band of the mix,
    // rung like a soft glass bell at a random stereo position.
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.chordToneHz(880), time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.022, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.random() * 1.4 - 0.7, time);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.lightsBus);
    osc.start(time);
    osc.stop(time + 1.85);
  }

  // Soft cinematic sub-thump and wind sweep
  spawnHit(time) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    // A slow rumble that swells in and dies away; the earlier 8 ms attack
    // read as a click on a beat.
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220 + Math.random() * 160, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 3.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.hitBus);
    noise.start(time);
    noise.stop(time + 3.3);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(70, time);
    thump.frequency.exponentialRampToValueAtTime(42, time + 2.2);
    thumpGain.gain.setValueAtTime(0.0001, time);
    thumpGain.gain.linearRampToValueAtTime(0.05, time + 0.35);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);
    thump.connect(thumpGain);
    thumpGain.connect(this.hitBus);
    thump.start(time);
    thump.stop(time + 2.7);
  }

  async close() {
    if (!this.ctx) return;
    this.fadeOut(0.2);
    this.stopEnvironment();
    const ctx = this.ctx;
    if (typeof ctx.close === 'function') {
      setTimeout(() => ctx.close().catch(() => {}), 260);
    }
    this.ctx = null;
    this.ready = false;
    this.initPromise = null;
    this.userGain = null;
    this.analyser = null;
    this.playRequested = false;
    this.hasPlayed = false;
    this.hasRun = false;
    this.failureStatus = null;
    this.emitState();
  }
}
