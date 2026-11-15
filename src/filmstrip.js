// The Studio filmstrips: one 256x256 frame per cell, baked into a single sprite
// sheet so playback needs no network at runtime. Three presets are available:
// the original 130-frame monthly MODIS decade for Cox's Bazar, plus two 27-frame
// annual NASA EIC series for Mount Everest and the Pacific Northwest wildfires.
//
// Frame order is chronological, so the date label is arithmetic on the index.
// Monthly presets step by month from `firstMonth`; yearly presets step by year
// and keep `firstMonth` as the fixed acquisition month. The sheet is read once at
// load time and every cell is reduced to a small feature vector, which is what
// the synth actually consumes. Nothing below the feature extraction sees pixels.

export const FILMSTRIP_PRESETS = Object.freeze({
  coxs_bazar: Object.freeze({
    id: 'coxs_bazar',
    title: "Cox's Bazar · 2000–2010 (MODIS Monthly)",
    src: './assets/textures/coxs-bazar-decade.jpg',
    cols: 13,
    rows: 10,
    cell: 256,
    frames: 130,
    firstYear: 2000,
    firstMonth: 3,
    stepMode: 'monthly',
    sourceCredit: 'NASA GIBS MODIS Terra true-colour + NASA POWER MERRA-2'
  }),
  mount_everest: Object.freeze({
    id: 'mount_everest',
    title: 'Mount Everest & Imja Glacier · 2000–2026 (NASA EIC SVS 4834)',
    src: './assets/textures/everest-filmstrip-2000-2026.jpg',
    cols: 9,
    rows: 3,
    cell: 256,
    frames: 27,
    firstYear: 2000,
    firstMonth: 11,
    stepMode: 'yearly',
    sourceCredit: 'NASA SVS ID 4834 & GIBS MODIS/VIIRS Cryosphere Series (2000–2026)'
  }),
  global_wildfires: Object.freeze({
    id: 'global_wildfires',
    title: 'Global Wildfires & Smoke · 2000–2026 (NASA EIC SVS 5113 & 5453)',
    src: './assets/textures/wildfires-filmstrip-2000-2026.jpg',
    cols: 9,
    rows: 3,
    cell: 256,
    frames: 27,
    firstYear: 2000,
    firstMonth: 8,
    stepMode: 'yearly',
    sourceCredit: 'NASA SVS ID 5113, ID 5453 & FIRMS VIIRS Thermal Anomalies (2000–2026)'
  })
});

// The original single-strip export stays for callers that only know the decade.
export const FILMSTRIP = FILMSTRIP_PRESETS.coxs_bazar;

export const MONTHS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]);

export function frameDate(index, preset = FILMSTRIP) {
  if (preset.stepMode === 'yearly') {
    return {
      year: preset.firstYear + index,
      month: preset.firstMonth
    };
  }
  const total = preset.firstMonth - 1 + index;
  return {
    year: preset.firstYear + Math.floor(total / 12),
    month: (total % 12) + 1
  };
}

export function frameLabel(index, preset = FILMSTRIP) {
  const { year, month } = frameDate(index, preset);
  return `${MONTHS[month - 1]} ${year}`;
}

// Fallback feature windows, used only when a sheet is too uniform to learn its
// own (see learnRanges). A value at or beyond an edge is 0 or 1.
export const FEATURE_RANGES = Object.freeze({
  lum: [55, 210],
  cloud: [0, 1],
  green: [-0.1, 0.3],
  edge: [8, 120],
  water: [0, 0.4],
  contrast: [2, 60]
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const norm = (v, range) => clamp01((v - range[0]) / (range[1] - range[0]));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load filmstrip: ${src}`));
    image.src = src;
  });
}

// Per cell, sampled on a 2 px grid.
//   brightness  Rec.709 luma L = 0.2126 R + 0.7152 G + 0.0722 B
//   greenness   VARI = (G - R) / (G + R - B), the visible-band vegetation
//               index; steadier under changing light than G - R
//   cloud/haze  bright AND grey: L > 165 and saturation (max-min)/max < 0.2,
//               so thin haze counts, not only pure white cloud
//   water       clearly blue: B > G + 8 and B > R + 14
//   detail      Sobel gradient magnitude sqrt(Gx^2 + Gy^2) on luma
//   contrast    standard deviation of luma
function measureCell(data, cell, step) {
  const lum = new Float32Array(cell * cell);
  for (let i = 0, o = 0; i < lum.length; i += 1, o += 4) {
    lum[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
  }

  let sumL = 0;
  let sumL2 = 0;
  let sumVari = 0;
  let nVari = 0;
  let cloud = 0;
  let water = 0;
  let edge = 0;
  let nEdge = 0;
  let n = 0;

  for (let y = 0; y < cell; y += step) {
    for (let x = 0; x < cell; x += step) {
      const i = y * cell + x;
      const o = i * 4;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const l = lum[i];
      sumL += l;
      sumL2 += l * l;

      const denom = g + r - b;
      if (denom > 12) {
        sumVari += (g - r) / denom;
        nVari += 1;
      }

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max > 0 ? (max - min) / max : 0;
      if (l > 165 && saturation < 0.2) cloud += 1;
      if (b > g + 8 && b > r + 14) water += 1;

      if (x > 0 && y > 0 && x < cell - 1 && y < cell - 1) {
        const a = lum[i - cell - 1], bb = lum[i - cell], c = lum[i - cell + 1];
        const d = lum[i - 1], f = lum[i + 1];
        const gg = lum[i + cell - 1], h = lum[i + cell], k = lum[i + cell + 1];
        const gx = (c + 2 * f + k) - (a + 2 * d + gg);
        const gy = (gg + 2 * h + k) - (a + 2 * bb + c);
        edge += Math.sqrt(gx * gx + gy * gy);
        nEdge += 1;
      }
      n += 1;
    }
  }

  const meanLum = sumL / n;
  const variance = Math.max(0, sumL2 / n - meanLum * meanLum);
  return {
    meanLum,
    cloudPct: cloud / n,
    greenness: nVari ? sumVari / nVari : 0,
    edgeMean: nEdge ? edge / nEdge : 0,
    waterPct: water / n,
    contrast: Math.sqrt(variance)
  };
}

const RAW_KEYS = { lum: 'meanLum', cloud: 'cloudPct', green: 'greenness', edge: 'edgeMean', water: 'waterPct', contrast: 'contrast' };

const isBlank = (raw) => raw.contrast < 0.5 && (raw.meanLum > 250 || raw.meanLum < 5);

// Windows learned from this sheet: the 5th to 95th percentile of each feature
// over its real (non-blank) frames, so every filmstrip uses its full range
// instead of numbers tuned to one sheet. Falls back to FEATURE_RANGES when a
// feature barely varies.
export function learnRanges(raws) {
  const real = raws.filter((raw) => !isBlank(raw));
  const ranges = {};
  for (const [key, rawKey] of Object.entries(RAW_KEYS)) {
    const values = real.map((raw) => raw[rawKey]).sort((a, b) => a - b);
    const at = (q) => values[Math.min(values.length - 1, Math.max(0, Math.round(q * (values.length - 1))))];
    const lo = values.length ? at(0.05) : NaN;
    const hi = values.length ? at(0.95) : NaN;
    const fallback = FEATURE_RANGES[key];
    ranges[key] = Number.isFinite(lo) && hi - lo > (fallback[1] - fallback[0]) * 0.05 ? [lo, hi] : fallback;
  }
  return ranges;
}

export function toFeatures(raw, ranges = FEATURE_RANGES) {
  // GIBS serves a uniform black tile when a day has no observation. Treat it as
  // missing data, not as a very dark scene, so the synth never invents a sound
  // for a frame that contains no measurement.
  return {
    lum: norm(raw.meanLum, ranges.lum),
    cloud: norm(raw.cloudPct, ranges.cloud),
    green: norm(raw.greenness, ranges.green),
    edge: norm(raw.edgeMean, ranges.edge),
    water: norm(raw.waterPct, ranges.water),
    contrast: norm(raw.contrast, ranges.contrast),
    blank: isBlank(raw),
    raw
  };
}

export async function loadFilmstrip(presetKey = 'coxs_bazar') {
  const preset = typeof presetKey === 'string' ? FILMSTRIP_PRESETS[presetKey] : presetKey;
  if (!preset) throw new Error(`Unknown filmstrip preset: ${presetKey}`);
  const image = await loadImage(preset.src);
  const { cols, rows, cell, frames } = preset;

  const sheet = document.createElement('canvas');
  sheet.width = cols * cell;
  sheet.height = rows * cell;
  const sheetCtx = sheet.getContext('2d', { willReadFrequently: true });
  sheetCtx.drawImage(image, 0, 0, sheet.width, sheet.height);

  const step = 2;
  const raws = [];
  const started = performance.now();

  for (let i = 0; i < frames; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const data = sheetCtx.getImageData(col * cell, row * cell, cell, cell).data;
    raws.push(measureCell(data, cell, step));
  }
  const ranges = learnRanges(raws);
  const perFrame = raws.map((raw) => toFeatures(raw, ranges));

  const elapsed = Math.round(performance.now() - started);

  return {
    image,
    sheet,
    preset,
    frames: perFrame,
    ranges,
    analysisMs: elapsed,
    draw(ctx, index, size) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, col * cell, row * cell, cell, cell, 0, 0, size, size);
    }
  };
}
