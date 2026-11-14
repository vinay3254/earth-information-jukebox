/**
 * Earth Information Jukebox — Frame Feature Extractor
 *
 * Extracts visual metrics from video frames via canvas:
 * - luma (mean, per-column, and 2D grid)
 * - motion (frame-to-frame absolute luma difference)
 * - hue balance (warm, cool, green fractions)
 * - hotspots (new sudden bright spots, e.g. lightning)
 * - color classes (coverage of specific aerosol classes)
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

/**
 * Convert RGB to Hue angle in degrees [0, 360).
 */
function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h = h * 60;
  return h < 0 ? h + 360 : h;
}

/**
 * Classify a pixel's hue into 'warm', 'green', 'cool', or null (neutral/achromatic).
 */
function classifyHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Neutral/desaturated check
  if (max < 28 || max - min < 20) return null;

  const h = rgbToHue(r, g, b);
  if (h >= 335 || h < 65) return 'warm';
  if (h >= 65 && h < 170) return 'green';
  return 'cool';
}

/**
 * Creates a frame feature extractor.
 *
 * @param {Object} [options]
 * @param {number} [options.width=160] - Analysis grid width
 * @param {number} [options.height=90] - Analysis grid height
 * @param {Record<string, [number, number, number]>} [options.colorClasses] - Named RGB prototypes
 */
export function createExtractor({ width = 160, height = 90, colorClasses = null } = {}) {
  let canvas = null;
  let ctx = null;

  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  const totalPixels = width * height;
  let prevLuma = new Float32Array(totalPixels);
  let lastLuma = new Float32Array(totalPixels);
  let lastDiff = new Float32Array(totalPixels);
  let hasPrev = false;
  let activeColorClasses = colorClasses ? { ...colorClasses } : null;

  return {
    /**
     * Update or set target color classes dynamically.
     */
    setColorClasses(classes) {
      activeColorClasses = classes ? { ...classes } : null;
    },

    /**
     * Set a custom canvas/context (useful for test environments or OffscreenCanvas).
     */
    _setContext(customCtx) {
      ctx = customCtx;
    },

    /**
     * Extract features from current video frame.
     *
     * @param {HTMLVideoElement|HTMLCanvasElement|{ currentTime?: number, videoWidth?: number, readyState?: number }} videoEl
     * @returns {import('./features.js').FrameFeatures}
     */
    analyze(videoEl) {
      const t = (videoEl && typeof videoEl.currentTime === 'number') ? videoEl.currentTime : 0;

      // Handle missing video or unready state
      const isReady = videoEl && (
        (typeof videoEl.readyState === 'number' && videoEl.readyState >= 2) ||
        (videoEl.videoWidth && videoEl.videoWidth > 0) ||
        (videoEl.width && videoEl.width > 0)
      );

      if (!isReady || !ctx) {
        return {
          t,
          width,
          height,
          luma: new Float32Array(totalPixels),
          meanLuma: 0,
          hue: { warm: 0, cool: 0, green: 0 },
          motion: 0,
          hotspots: [],
          columnLuma: new Float32Array(width),
          classes: activeColorClasses ? Object.fromEntries(Object.keys(activeColorClasses).map(k => [k, 0])) : {}
        };
      }

      try {
        ctx.drawImage(videoEl, 0, 0, width, height);
      } catch {
        // Fallback if drawImage fails (e.g. security/CORS or detached element)
        return {
          t,
          width,
          height,
          luma: lastLuma,
          meanLuma: 0,
          hue: { warm: 0, cool: 0, green: 0 },
          motion: 0,
          hotspots: [],
          columnLuma: new Float32Array(width),
          classes: {}
        };
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const currLuma = new Float32Array(totalPixels);
      const columnLumaSum = new Float64Array(width);
      let sumLuma = 0;
      let motionSum = 0;
      let warmCount = 0;
      let coolCount = 0;
      let greenCount = 0;

      // Class coverage counts
      const classKeys = activeColorClasses ? Object.keys(activeColorClasses) : [];
      const classCounts = {};
      for (const key of classKeys) {
        classCounts[key] = 0;
      }

      // Candidate hotspot grid (downsampled 16 x 9 blocks to find localized peaks)
      const blockCols = 16;
      const blockRows = 9;
      const blockPeaks = new Array(blockCols * blockRows).fill(null);

      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const blockY = Math.min(blockRows - 1, Math.floor((y / height) * blockRows));

        for (let x = 0; x < width; x++) {
          const idx = rowOffset + x;
          const px = idx * 4;
          const r = data[px];
          const g = data[px + 1];
          const b = data[px + 2];

          // ITU-R BT.601 luma formula
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
          currLuma[idx] = lum;
          sumLuma += lum;
          columnLumaSum[x] += lum;

          // Motion and frame diff
          const diff = hasPrev ? Math.abs(lum - prevLuma[idx]) : 0;
          lastDiff[idx] = diff;
          motionSum += diff;

          // Hotspots: sudden bright spot
          // Needs significant positive increase or extreme brightness if no previous frame
          const isSpike = hasPrev ? (lum - prevLuma[idx] > 0.16 && lum > 0.28) : (lum > 0.65);
          if (isSpike) {
            const blockX = Math.min(blockCols - 1, Math.floor((x / width) * blockCols));
            const bIdx = blockY * blockCols + blockX;
            const strength = Math.min(1.0, (hasPrev ? (lum - prevLuma[idx]) * 1.8 : lum) * (lum + 0.2));
            if (!blockPeaks[bIdx] || blockPeaks[bIdx].strength < strength) {
              blockPeaks[bIdx] = {
                x: (x + 0.5) / width,
                y: (y + 0.5) / height,
                strength
              };
            }
          }

          // Hue balance
          const hueType = classifyHue(r, g, b);
          if (hueType === 'warm') warmCount++;
          else if (hueType === 'cool') coolCount++;
          else if (hueType === 'green') greenCount++;

          // Color class matching (for aerosols: dust, smoke, sea salt, sulfate)
          if (classKeys.length > 0 && Math.max(r, g, b) > 28) {
            let bestDistSq = Infinity;
            let bestClass = null;

            for (let k = 0; k < classKeys.length; k++) {
              const cName = classKeys[k];
              const [cr, cg, cb] = activeColorClasses[cName];
              const dr = r - cr;
              const dg = g - cg;
              const db = b - cb;
              const distSq = dr * dr + dg * dg + db * db;
              if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestClass = cName;
              }
            }

            // Match threshold: max distance ~160 in RGB space
            if (bestClass && bestDistSq < 25600) {
              classCounts[bestClass]++;
            }
          }
        }
      }

      // Column luma
      const columnLuma = new Float32Array(width);
      for (let x = 0; x < width; x++) {
        columnLuma[x] = columnLumaSum[x] / height;
      }

      const meanLuma = sumLuma / totalPixels;
      const motion = hasPrev ? (motionSum / totalPixels) : 0;

      // Hotspots list (sorted by strength, max 10)
      const hotspots = blockPeaks
        .filter(Boolean)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 10);

      // Classes coverage fractions
      const classes = {};
      for (const key of classKeys) {
        classes[key] = classCounts[key] / totalPixels;
      }

      // Update state for next frame
      prevLuma.set(currLuma);
      lastLuma = currLuma;
      hasPrev = true;

      return {
        t,
        width,
        height,
        luma: currLuma,
        meanLuma,
        hue: {
          warm: warmCount / totalPixels,
          cool: coolCount / totalPixels,
          green: greenCount / totalPixels
        },
        motion,
        hotspots,
        columnLuma,
        classes
      };
    },

    /**
     * Sample region features around a normalized coordinate.
     *
     * @param {number} xNorm - 0..1
     * @param {number} yNorm - 0..1
     * @param {number} [radiusNorm=0.05] - 0..1
     * @returns {{ luma: number, hueName: 'warm'|'cool'|'green'|'dark', motion: number }}
     */
    sampleAt(xNorm, yNorm, radiusNorm = 0.05) {
      if (!ctx || !hasPrev) {
        return { luma: 0, hueName: 'dark', motion: 0 };
      }

      const cx = Math.max(0, Math.min(width - 1, Math.round(xNorm * (width - 1))));
      const cy = Math.max(0, Math.min(height - 1, Math.round(yNorm * (height - 1))));
      const r = Math.max(1, Math.round(radiusNorm * Math.min(width, height)));
      const rSq = r * r;

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      let lumaSum = 0;
      let motionSum = 0;
      let count = 0;
      let warm = 0;
      let cool = 0;
      let green = 0;

      const minY = Math.max(0, cy - r);
      const maxY = Math.min(height - 1, cy + r);
      const minX = Math.max(0, cx - r);
      const maxX = Math.min(width - 1, cx + r);

      for (let y = minY; y <= maxY; y++) {
        const dy = y - cy;
        const rowOffset = y * width;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= rSq) {
            const idx = rowOffset + x;
            const px = idx * 4;
            const lum = lastLuma[idx];
            lumaSum += lum;
            motionSum += lastDiff[idx];
            count++;

            const hType = classifyHue(data[px], data[px + 1], data[px + 2]);
            if (hType === 'warm') warm++;
            else if (hType === 'cool') cool++;
            else if (hType === 'green') green++;
          }
        }
      }

      if (count === 0) {
        return { luma: 0, hueName: 'dark', motion: 0 };
      }

      const meanLuma = lumaSum / count;
      const meanMotion = motionSum / count;

      let hueName = 'dark';
      if (meanLuma >= 0.10) {
        if (warm >= cool && warm >= green && warm > 0) {
          hueName = 'warm';
        } else if (green >= cool && green >= warm && green > 0) {
          hueName = 'green';
        } else if (cool > 0) {
          hueName = 'cool';
        } else {
          hueName = meanLuma > 0.4 ? 'warm' : 'cool';
        }
      }

      return {
        luma: Math.max(0, Math.min(1, meanLuma)),
        hueName,
        motion: Math.max(0, Math.min(1, meanMotion))
      };
    }
  };
}
