// Web Audio engine for HEARTH Planetary Geospatial Sonification Observatory.
// Spans 28 planetary destinations: authentic spatial environment audio soundscapes
// paired with harmonic layers driven by real yearly data (NASA POWER per place,
// NOAA Mauna Loa CO2), 1985-2025.
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

import { SIGNALS } from './regions.js';

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
// colder places sit lower and darker, hotter places higher. Semitone offsets
// from A, chosen from keys that keep the pentatonic voicing consonant.
const KEY_OFFSETS = [-5, -3, 0, 2, 5, 7];
const PAD_BASE = [110, 164.81, 220, 329.63];

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
    gain.setValueAtTime(this.muted ? 0 : this.volume, this.now);
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
    master.connect(compressor);

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

    this.activeSoundscapeName = meta.name;
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
    if (this.ready) this.apply(this.now);
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

  // Semitone offset for the current place, from its 1985-2025 mean temperature.
  placeTranspose() {
    const stats = this.region ? this.stats(this.region, 'temperature') : null;
    if (!stats) return 0;
    const all = Object.values(this.region.years || {}).map((row) => Number(row?.temperature)).filter(Number.isFinite);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const k = absoluteNorm('temperature', mean);
    return KEY_OFFSETS[Math.min(KEY_OFFSETS.length - 1, Math.floor(k * KEY_OFFSETS.length))];
  }

  readValues() {
    const norms = {};
    this.keyRatio = Math.pow(2, this.placeTranspose() / 12);
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
    const glide = 0.45;
    const key = this.keyRatio || 1;

    // The place's key moves the whole harmony (pad voices keep their chord).
    PAD_BASE.forEach((freq, i) => this.padVoices[i]?.frequency.setTargetAtTime(freq * key, now, 0.8));

    // Temperature -> melody note, snapped to A-minor pentatonic (A3-E5) so it
    // always agrees with the pad.
    const temp = on('temperature') ? n.temperature : null;
    if (temp !== null) {
      // The place's key already carries how hot it is; the note within the key
      // follows the year-to-year change, so warming years climb the scale.
      const change = this.changes?.temperature ?? temp;
      const step = LEAD_SCALE[Math.round(change * (LEAD_SCALE.length - 1))];
      this.lead.frequency.setTargetAtTime(220 * key * Math.pow(2, step / 12), now, glide);
    }
    this.leadGain.gain.setTargetAtTime(temp === null ? 0 : db(-23), now, glide);

    // Cloud cover -> pad brightness (clear sky = bright, log-scaled cutoff
    // 350-2400 Hz) and a soft haze band (700-1500 Hz) panned left.
    const cloud = on('cloud') ? n.cloud : null;
    this.padFilter.frequency.setTargetAtTime(logMap(cloud === null ? 0.5 : 1 - cloud, 350, 2400), now, glide);
    this.padGain.gain.setTargetAtTime(cloud === null ? 0 : 0.55, now, glide);
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
    this.reverbWet.gain.setTargetAtTime(humidity === null ? 0.05 : 0.06 + humidity * 0.5, now, 0.5);

    // CO2 (global) -> detune of pad and melody, 0-22 cents.
    const carbon = on('carbon') ? n.carbon : null;
    const cents = carbon === null ? 0 : carbon * 22;
    for (const voice of this.padVoices) voice.detune.setTargetAtTime(cents, now, 0.5);
    this.lead.detune.setTargetAtTime(cents, now, 0.5);

    // Event layers, as random (Poisson) arrivals per second:
    // rain drops up to ~2.3/s, sunlight chimes up to ~1/s.
    this.rates.rain = on('rain') ? 0.1 + n.rain * 2.2 : 0;
    this.rates.lights = on('sunlight') ? 0.08 + n.sunlight * 0.9 : 0;
    this.rates.disasters = 0;

    this.rainBus.gain.setTargetAtTime(on('rain') ? 0.55 : 0, now, 0.2);
    this.lightsBus.gain.setTargetAtTime(on('sunlight') ? 0.45 : 0, now, 0.2);
    this.hitBus.gain.setTargetAtTime(0, now, 0.2);
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
    const degree = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];

    // Drops sit above the melody (440-880 Hz) so they never mask it.
    const baseFreq = 440 * (this.keyRatio || 1) * Math.pow(2, degree / 12);
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
    // A random note rather than stepping up the scale, so it never ticks.
    const degree = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];

    // Sunlight chimes: A-minor pentatonic around A5, the top band of the mix,
    // rung like a soft glass bell at a random stereo position.
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880 * (this.keyRatio || 1) * Math.pow(2, degree / 12), time);

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
