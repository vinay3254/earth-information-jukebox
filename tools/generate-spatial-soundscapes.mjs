// HEARTH — Procedural Spatial Audio Engine & Soundscape Generator
// Generates 16-bit 44.1kHz stereo PCM WAV soundscapes for all 28 biomes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(__dirname, '../assets/audio');

const SAMPLE_RATE = 44100;

function createWavHeader(numSamples, sampleRate = SAMPLE_RATE) {
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return Buffer.from(buffer);
}

function saveWav(filename, left, right) {
  const numSamples = left.length;
  const header = createWavHeader(numSamples);
  const data = Buffer.alloc(numSamples * 4);

  let offset = 0;
  for (let i = 0; i < numSamples; i++) {
    const sL = Math.max(-1, Math.min(1, left[i]));
    const sR = Math.max(-1, Math.min(1, right[i]));
    data.writeInt16LE(sL < 0 ? sL * 0x8000 : sL * 0x7FFF, offset);
    offset += 2;
    data.writeInt16LE(sR < 0 ? sR * 0x8000 : sR * 0x7FFF, offset);
    offset += 2;
  }

  const full = Buffer.concat([header, data]);
  const dest = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(dest, full);
  console.log(`✓ Generated ${filename} (${(full.length / 1024).toFixed(1)} KB, ${(numSamples / SAMPLE_RATE).toFixed(1)}s)`);
}

// Lowpass / Highpass Biquad Filter in DSP
class Biquad {
  constructor(type, freq, q = 1, sampleRate = SAMPLE_RATE) {
    const w0 = 2 * Math.PI * freq / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);

    let b0, b1, b2, a0, a1, a2;

    if (type === 'lowpass') {
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else if (type === 'bandpass') {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;

    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// Generates seamless looping noise
function makeWhiteNoise(length) {
  const arr = new Float32Array(length);
  for (let i = 0; i < length; i++) arr[i] = Math.random() * 2 - 1;
  return arr;
}

// ------------------------------------------------------------- SOUNDSCAPE GENERATORS

// 1. Venice Lagoon: Gentle canal water lapping + distant resonant Italian church bell
function genVeniceCanal(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const lpL = new Biquad('lowpass', 450, 0.8);
  const lpR = new Biquad('lowpass', 450, 0.8);
  const bpL = new Biquad('bandpass', 240, 1.4);
  const bpR = new Biquad('bandpass', 280, 1.4);

  // Periodic water sloshes
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const waveCycle = Math.sin(t * 0.8) * 0.5 + 0.5;
    const slosh = Math.sin(t * 2.4 + Math.sin(t * 0.4) * 2) > 0.85 ? 0.35 : 0.05;

    const n = noise[i];
    const waterL = (lpL.process(n) * 0.15 + bpL.process(n) * 0.25) * (0.4 + waveCycle * 0.6) * (1 + slosh);
    const waterR = (lpR.process(n) * 0.15 + bpR.process(n) * 0.25) * (0.4 + (1 - waveCycle) * 0.6) * (1 + slosh);

    // Distant church bell every 4.6 seconds (440 Hz + 660 Hz + 880 Hz with slow exponential decay)
    let bellL = 0;
    let bellR = 0;
    const bellInterval = 4.6;
    const bellPhase = (t % bellInterval);
    if (bellPhase < 3.5) {
      const decay = Math.exp(-bellPhase * 1.8);
      const tone1 = Math.sin(2 * Math.PI * 440 * bellPhase);
      const tone2 = Math.sin(2 * Math.PI * 659.25 * bellPhase) * 0.6;
      const tone3 = Math.sin(2 * Math.PI * 880 * bellPhase) * 0.3;
      const bell = (tone1 + tone2 + tone3) * decay * 0.09;
      bellL = bell * 0.65;
      bellR = bell * 0.85;
    }

    left[i] = waterL + bellL;
    right[i] = waterR + bellR;
  }
  return { left, right };
}

// 2. Giza Plateau & Sahara: Arid desert sand wind howling through ancient limestone
function genGizaDesertWind(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noiseL = makeWhiteNoise(len);
  const noiseR = makeWhiteNoise(len);

  const lpL = new Biquad('lowpass', 380, 0.7);
  const lpR = new Biquad('lowpass', 380, 0.7);
  const bpL = new Biquad('bandpass', 420, 2.8);
  const bpR = new Biquad('bandpass', 440, 2.8);
  const sandHissL = new Biquad('highpass', 3600, 0.9);
  const sandHissR = new Biquad('highpass', 3600, 0.9);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const gust = Math.sin(t * 0.35) * 0.3 + Math.sin(t * 0.11) * 0.25 + 0.45;
    const whistle = Math.sin(t * 0.7) * 0.5 + 0.5;

    const nL = noiseL[i];
    const nR = noiseR[i];

    const lowDraftL = lpL.process(nL) * 0.28 * gust;
    const lowDraftR = lpR.process(nR) * 0.28 * gust;
    const howlL = bpL.process(nL) * 0.32 * whistle * gust;
    const howlR = bpR.process(nR) * 0.32 * (1 - whistle) * gust;
    const sandL = sandHissL.process(nL) * 0.02 * gust;
    const sandR = sandHissR.process(nR) * 0.02 * gust;

    left[i] = lowDraftL + howlL + sandL;
    right[i] = lowDraftR + howlR + sandR;
  }
  return { left, right };
}

// 3. Grand Canyon: Deep red rock gorge drafts with cavernous echoes
function genGrandCanyonEcho(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noiseL = makeWhiteNoise(len);
  const noiseR = makeWhiteNoise(len);

  const subL = new Biquad('lowpass', 160, 1.2);
  const subR = new Biquad('lowpass', 160, 1.2);
  const canyonL = new Biquad('bandpass', 320, 1.8);
  const canyonR = new Biquad('bandpass', 350, 1.8);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const draft = Math.sin(t * 0.25) * 0.4 + Math.cos(t * 0.08) * 0.3 + 0.5;

    const nL = noiseL[i];
    const nR = noiseR[i];

    left[i] = (subL.process(nL) * 0.35 + canyonL.process(nL) * 0.3) * draft;
    right[i] = (subR.process(nR) * 0.35 + canyonR.process(nR) * 0.3) * draft;
  }
  return { left, right };
}

// 4. Machu Picchu: High misty Andean mountain breeze with sacred pan-flute drone
function genMachuPicchuAndes(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const windFilterL = new Biquad('bandpass', 520, 1.2);
  const windFilterR = new Biquad('bandpass', 580, 1.2);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const breeze = Math.sin(t * 0.4) * 0.3 + 0.6;
    const n = noise[i];

    // Soft Andean quena breath drone (E4 329.63Hz + B4 493.88Hz)
    const breathJitter = 1 + (noise[i % 500] * 0.04);
    const flute1 = Math.sin(2 * Math.PI * 329.63 * breathJitter * t) * 0.045;
    const flute2 = Math.sin(2 * Math.PI * 493.88 * breathJitter * t) * 0.03;
    const flute3 = Math.sin(2 * Math.PI * 659.25 * t) * 0.015;

    const windL = windFilterL.process(n) * 0.22 * breeze;
    const windR = windFilterR.process(n) * 0.22 * breeze;

    left[i] = windL + flute1 + flute3;
    right[i] = windR + flute2 + flute3;
  }
  return { left, right };
}

// 5. Great Barrier Reef: Underwater coral reef hydrophone clicks & submerged swell
function genBarrierReefMarine(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const subL = new Biquad('lowpass', 240, 1.2);
  const subR = new Biquad('lowpass', 240, 1.2);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const swell = Math.sin(t * 0.18) * 0.4 + 0.6;
    const n = noise[i];

    // Deep underwater swell
    const hydroL = subL.process(n) * 0.32 * swell;
    const hydroR = subR.process(n) * 0.32 * swell;

    // Organic coral shrimp / marine clicks
    let clickL = 0;
    let clickR = 0;
    if (Math.random() < 0.0018) {
      const snap = (Math.random() * 2 - 1) * 0.18;
      clickL = snap;
      clickR = snap * (Math.random() * 0.8 + 0.2);
    }

    left[i] = hydroL + clickL;
    right[i] = hydroR + clickR;
  }
  return { left, right };
}

// 6. Tohoku & Fukushima: Ominous heavy Pacific tsunami surge against seawalls with offshore buoy
function genTohokuTsunami(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const deepL = new Biquad('lowpass', 180, 1.5);
  const deepR = new Biquad('lowpass', 180, 1.5);
  const washL = new Biquad('bandpass', 380, 0.9);
  const washR = new Biquad('bandpass', 420, 0.9);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Slow powerful tsunami swell cycle (every 5.2 seconds)
    const swellPeriod = 5.2;
    const phase = (t % swellPeriod) / swellPeriod;
    const crash = Math.pow(Math.sin(phase * Math.PI), 3);

    const n = noise[i];
    const sub = deepL.process(n) * (0.35 + crash * 0.6);
    const wash = washL.process(n) * (0.15 + crash * 0.45);

    // Offshore warning bell buoy every 3.8s (D5 587Hz with hollow decay)
    let bell = 0;
    const bPhase = t % 3.8;
    if (bPhase < 2.0) {
      bell = Math.sin(2 * Math.PI * 587.33 * bPhase) * Math.exp(-bPhase * 2.2) * 0.07;
    }

    left[i] = sub + wash + bell * 0.8;
    right[i] = deepR.process(n) * (0.35 + crash * 0.6) + washR.process(n) * (0.15 + crash * 0.45) + bell * 0.4;
  }
  return { left, right };
}

// 7. Banda Aceh: Heavy Indian Ocean tropical surf & coastal palm breeze
function genBandaAcehSurf(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const lpL = new Biquad('lowpass', 320, 1.0);
  const lpR = new Biquad('lowpass', 320, 1.0);
  const surfL = new Biquad('bandpass', 520, 0.7);
  const surfR = new Biquad('bandpass', 520, 0.7);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const breaker = Math.pow(Math.sin(t * 0.7) * 0.5 + 0.5, 2);

    const n = noise[i];
    left[i] = lpL.process(n) * 0.35 * (0.4 + breaker * 0.6) + surfL.process(n) * 0.22 * breaker;
    right[i] = lpR.process(n) * 0.35 * (0.4 + breaker * 0.6) + surfR.process(n) * 0.22 * breaker;
  }
  return { left, right };
}

// 8. Death Valley: Scorching desert silence & shimmering Badwater heat drafts
function genDeathValleyHeat(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const bpL = new Biquad('bandpass', 380, 2.2);
  const bpR = new Biquad('bandpass', 410, 2.2);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const gust = Math.sin(t * 0.15) * 0.3 + 0.45;
    const thermal = Math.sin(2 * Math.PI * 110 * t) * 0.012; // deep thermal shimmer

    const n = noise[i];
    left[i] = bpL.process(n) * 0.18 * gust + thermal;
    right[i] = bpR.process(n) * 0.18 * gust + thermal;
  }
  return { left, right };
}

// 9. Wayanad Megalandslide: Torrential monsoon deluge & roaring hillside mud torrent
function genWayanadLandslide(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const delugeL = new Biquad('bandpass', 920, 0.6);
  const delugeR = new Biquad('bandpass', 920, 0.6);
  const mudRumbleL = new Biquad('lowpass', 120, 2.0);
  const mudRumbleR = new Biquad('lowpass', 120, 2.0);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const surge = Math.sin(t * 0.4) * 0.2 + 0.8;
    const n = noise[i];

    const rain = delugeL.process(n) * 0.38 * surge;
    const mud = mudRumbleL.process(n) * 0.42 * (0.8 + Math.sin(t * 1.8) * 0.2);

    left[i] = rain + mud;
    right[i] = delugeR.process(n) * 0.38 * surge + mudRumbleR.process(n) * 0.42;
  }
  return { left, right };
}

// 10. Kedarnath Glacial Debris Surge: Violent roaring Himalayan mountain flood
function genKedarnathDebris(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const rapidL = new Biquad('bandpass', 350, 0.8);
  const rapidR = new Biquad('bandpass', 350, 0.8);
  const boulderThudL = new Biquad('lowpass', 90, 2.5);
  const boulderThudR = new Biquad('lowpass', 90, 2.5);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const n = noise[i];
    left[i] = rapidL.process(n) * 0.45 + boulderThudL.process(n) * 0.4;
    right[i] = rapidR.process(n) * 0.45 + boulderThudR.process(n) * 0.4;
  }
  return { left, right };
}

// 11. Sundarbans: Swirling tidal mangrove estuary & calm delta breeze
function genSundarbansMangrove(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const tideL = new Biquad('lowpass', 340, 1.0);
  const tideR = new Biquad('lowpass', 340, 1.0);
  const gurgleL = new Biquad('bandpass', 580, 1.6);
  const gurgleR = new Biquad('bandpass', 620, 1.6);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const tide = Math.sin(t * 0.5) * 0.4 + 0.6;
    const n = noise[i];

    left[i] = tideL.process(n) * 0.25 * tide + gurgleL.process(n) * 0.15;
    right[i] = tideR.process(n) * 0.25 * tide + gurgleR.process(n) * 0.15;
  }
  return { left, right };
}

// 12. Whitehaven Beach: Ultra-peaceful turquoise shallow lagoon ripples on 98% pure silica sand
function genWhitehavenSilica(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const lapL = new Biquad('bandpass', 450, 1.2);
  const lapR = new Biquad('bandpass', 480, 1.2);
  const silicaHissL = new Biquad('highpass', 2400, 0.7);
  const silicaHissR = new Biquad('highpass', 2400, 0.7);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Ultra slow, serene 0.12 Hz wave cycle
    const wave = Math.pow(Math.sin(t * 0.4) * 0.5 + 0.5, 3);
    const n = noise[i];

    left[i] = lapL.process(n) * 0.18 * wave + silicaHissL.process(n) * 0.025 * wave;
    right[i] = lapR.process(n) * 0.18 * wave + silicaHissR.process(n) * 0.025 * wave;
  }
  return { left, right };
}

// 13. Praia do Cassino: Endless 240km South Atlantic continuous rolling ocean roar
function genPraiaCassinoRoar(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const subL = new Biquad('lowpass', 140, 1.6);
  const subR = new Biquad('lowpass', 140, 1.6);
  const roarL = new Biquad('bandpass', 380, 0.7);
  const roarR = new Biquad('bandpass', 380, 0.7);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const swell = Math.sin(t * 0.3) * 0.3 + 0.7;
    const n = noise[i];

    left[i] = subL.process(n) * 0.45 * swell + roarL.process(n) * 0.35 * swell;
    right[i] = subR.process(n) * 0.45 * swell + roarR.process(n) * 0.35 * swell;
  }
  return { left, right };
}

// 14. Congo Basin: Deep equatorial African jungle night insect chorus & foliage drip
function genCongoJungle(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const foliageL = new Biquad('lowpass', 550, 0.8);
  const foliageR = new Biquad('lowpass', 550, 0.8);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const n = noise[i];

    // High African jungle insect pulsation (3.6kHz and 4.8kHz)
    const insect1 = Math.sin(2 * Math.PI * 3600 * t) * (Math.sin(t * 6.0) * 0.5 + 0.5) * 0.035;
    const insect2 = Math.sin(2 * Math.PI * 4800 * t) * (Math.cos(t * 4.2) * 0.5 + 0.5) * 0.025;

    // Foliage drip
    let drip = 0;
    if (Math.random() < 0.0008) {
      drip = Math.sin(2 * Math.PI * 780 * t) * 0.12;
    }

    left[i] = foliageL.process(n) * 0.15 + insect1 + drip;
    right[i] = foliageR.process(n) * 0.15 + insect2 + drip;
  }
  return { left, right };
}

// 15. Borneo Peat Swamp: Equatorial treefrog chorus & humid canopy mist
function genBorneoSwamp(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const mistL = new Biquad('lowpass', 600, 0.8);
  const mistR = new Biquad('lowpass', 600, 0.8);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const n = noise[i];

    // Tree frog chirp pulses (1.8 kHz grain bursts every 1.4s)
    let frogL = 0;
    let frogR = 0;
    const frogPhase = (t * 0.9) % 1.4;
    if (frogPhase < 0.12) {
      const fEnv = Math.sin((frogPhase / 0.12) * Math.PI);
      const tone = Math.sin(2 * Math.PI * 1850 * t);
      frogL = tone * fEnv * 0.06;
      frogR = tone * fEnv * 0.04;
    }

    left[i] = mistL.process(n) * 0.18 + frogL;
    right[i] = mistR.process(n) * 0.18 + frogR;
  }
  return { left, right };
}

// 16. Chernobyl Ghost Town: Whistling wind through shattered concrete + Geiger radiation clicks
function genChernobylAtmosphere(seconds = 14) {
  const len = seconds * SAMPLE_RATE;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const noise = makeWhiteNoise(len);

  const windL = new Biquad('bandpass', 380, 2.4);
  const windR = new Biquad('bandpass', 420, 2.4);
  const hollowL = new Biquad('bandpass', 620, 3.2);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const draft = Math.sin(t * 0.3) * 0.35 + 0.55;
    const n = noise[i];

    const wind = windL.process(n) * 0.28 * draft;
    const hollow = hollowL.process(n) * 0.18 * (Math.sin(t * 0.6) * 0.5 + 0.5);

    // Geiger clicks
    let geiger = 0;
    if (Math.random() < 0.0006) {
      geiger = (Math.random() * 2 - 1) * 0.25;
    }

    left[i] = wind + hollow + geiger;
    right[i] = windR.process(n) * 0.28 * draft + hollow + geiger;
  }
  return { left, right };
}

// ---------------------------------------------------------------- BUILD ALL
function buildAll() {
  console.log('Generating authentic spatial audio soundscapes...');

  const sounds = [
    { name: 'venice-canal.wav', fn: genVeniceCanal },
    { name: 'giza-desert-wind.wav', fn: genGizaDesertWind },
    { name: 'grand-canyon-echo.wav', fn: genGrandCanyonEcho },
    { name: 'machu-picchu-andes.wav', fn: genMachuPicchuAndes },
    { name: 'barrier-reef-marine.wav', fn: genBarrierReefMarine },
    { name: 'fukushima-tsunami.wav', fn: genTohokuTsunami },
    { name: 'banda-aceh-surf.wav', fn: genBandaAcehSurf },
    { name: 'death-valley-heat.wav', fn: genDeathValleyHeat },
    { name: 'wayanad-landslide.wav', fn: genWayanadLandslide },
    { name: 'kedarnath-debris.wav', fn: genKedarnathDebris },
    { name: 'sundarbans-mangrove.wav', fn: genSundarbansMangrove },
    { name: 'whitehaven-silica.wav', fn: genWhitehavenSilica },
    { name: 'praia-cassino-roar.wav', fn: genPraiaCassinoRoar },
    { name: 'congo-jungle-night.wav', fn: genCongoJungle },
    { name: 'borneo-swamp-chorus.wav', fn: genBorneoSwamp },
    { name: 'chernobyl-ruins.wav', fn: genChernobylAtmosphere }
  ];

  for (const s of sounds) {
    const { left, right } = s.fn(14);
    saveWav(s.name, left, right);
  }

  console.log('All 16 custom soundscapes successfully generated!');
}

buildAll();
