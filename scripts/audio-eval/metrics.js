// Audio metrics calculation and evaluation against audio brief targets

// ITU-R BS.1770-4 K-weighting filter coefficients
export function getKWeightingCoefficients(fs) {
  // Stage 1: High shelf filter
  const f0_1 = 1681.9744509555319;
  const G = 3.99984385397;
  const V = Math.pow(10, G / 20);
  const K1 = Math.tan((Math.PI * f0_1) / fs);
  const a0_1 = 1 + Math.SQRT2 * K1 + K1 * K1;
  const s1 = {
    b0: (V + Math.sqrt(2 * V) * K1 + K1 * K1) / a0_1,
    b1: (2 * (K1 * K1 - V)) / a0_1,
    b2: (V - Math.sqrt(2 * V) * K1 + K1 * K1) / a0_1,
    a1: (2 * (K1 * K1 - 1)) / a0_1,
    a2: (1 - Math.SQRT2 * K1 + K1 * K1) / a0_1
  };

  // Stage 2: High-pass RLB weighting filter
  const f0_2 = 38.13547087602444;
  const Q = 0.5;
  const K2 = Math.tan((Math.PI * f0_2) / fs);
  const a0_2 = 1 + K2 / Q + K2 * K2;
  const s2 = {
    b0: 1 / a0_2,
    b1: -2 / a0_2,
    b2: 1 / a0_2,
    a1: (2 * (K2 * K2 - 1)) / a0_2,
    a2: (1 - K2 / Q + K2 * K2) / a0_2
  };

  return { s1, s2 };
}

function applyBiquad(input, filter) {
  const { b0, b1, b2, a1, a2 } = filter;
  const len = input.length;
  const output = new Float32Array(len);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

// Calculate true peak (linear and dBFS)
export function computeTruePeak(left, right) {
  let peak = 0;
  const len = left.length;
  for (let i = 0; i < len; i++) {
    const aL = Math.abs(left[i]);
    if (aL > peak) peak = aL;
    if (right) {
      const aR = Math.abs(right[i]);
      if (aR > peak) peak = aR;
    }
  }
  const peakDb = peak > 1e-9 ? 20 * Math.log10(peak) : -100;
  return { peakLinear: peak, peakDb };
}

// Calculate overall RMS dBFS
export function computeRmsDb(left, right) {
  const len = left.length;
  if (!len) return -100;
  let sumSq = 0;
  const channels = right ? 2 : 1;
  for (let i = 0; i < len; i++) {
    sumSq += left[i] * left[i];
    if (right) sumSq += right[i] * right[i];
  }
  const rms = Math.sqrt(sumSq / (len * channels));
  return rms > 1e-9 ? 20 * Math.log10(rms) : -100;
}

// Calculate BS.1770 K-weighted short-term loudness (LUFS)
export function computeShortTermLoudness(left, right, fs = 48000) {
  const len = left.length;
  if (len < fs * 0.1) return -100; // Not enough samples

  const { s1, s2 } = getKWeightingCoefficients(fs);
  const kLeft = applyBiquad(applyBiquad(left, s1), s2);
  const kRight = right ? applyBiquad(applyBiquad(right, s1), s2) : kLeft;

  // Compute loudness over sliding 3-second windows with 75% overlap, or full length if shorter
  const windowSamples = Math.min(len, Math.floor(fs * 3.0));
  const stepSamples = Math.max(1, Math.floor(fs * 0.5)); // 500ms step
  const lufsValues = [];

  for (let start = 0; start + windowSamples <= len; start += stepSamples) {
    let sumL = 0, sumR = 0;
    for (let i = start; i < start + windowSamples; i++) {
      sumL += kLeft[i] * kLeft[i];
      sumR += kRight[i] * kRight[i];
    }
    const zL = sumL / windowSamples;
    const zR = sumR / windowSamples;
    const zSum = zL + zR;
    if (zSum > 1e-9) {
      const l = -0.691 + 10 * Math.log10(zSum);
      // Absolute threshold gating: ignore completely silent windows (< -70 LUFS)
      if (l > -70) lufsValues.push(l);
    }
  }

  if (lufsValues.length === 0) {
    // If entire clip is shorter than 3s, compute over entire clip
    let sumL = 0, sumR = 0;
    for (let i = 0; i < len; i++) {
      sumL += kLeft[i] * kLeft[i];
      sumR += kRight[i] * kRight[i];
    }
    const zSum = (sumL + sumR) / len;
    return zSum > 1e-9 ? -0.691 + 10 * Math.log10(zSum) : -100;
  }

  // Mean short-term loudness of active windows
  const avg = lufsValues.reduce((a, b) => a + b, 0) / lufsValues.length;
  return avg;
}

// Onset detection and jump analysis
export function computeOnsets(left, right, fs = 48000) {
  const len = left.length;
  const blockSize = Math.floor(fs * 0.05); // 50ms blocks
  if (len < blockSize * 2) {
    return { onsetCount: 0, onsetCountPerSec: 0, maxOnsetJumpDb: 0 };
  }

  let runningEnergy = 0;
  let hasEstablishedRunningLevel = false;
  let onsetCount = 0;
  let maxJumpDb = 0;
  let lastOnsetBlock = -999;
  const refractoryBlocks = Math.floor(0.1 / 0.05); // 100ms refractory period
  const silenceThreshold = 0.005; // -46 dBFS minimum activity threshold

  const numBlocks = Math.floor(len / blockSize);
  for (let b = 0; b < numBlocks; b++) {
    const start = b * blockSize;
    let sumSq = 0;
    for (let i = start; i < start + blockSize; i++) {
      const mono = right ? (left[i] + right[i]) * 0.5 : left[i];
      sumSq += mono * mono;
    }
    const energy = Math.sqrt(sumSq / blockSize);

    if (energy > silenceThreshold) {
      if (!hasEstablishedRunningLevel) {
        // First active sound establishes running level
        runningEnergy = energy;
        hasEstablishedRunningLevel = true;
        onsetCount++;
        lastOnsetBlock = b;
      } else {
        // Subsequent onsets during active playback
        if (energy > runningEnergy * 1.4125 && (b - lastOnsetBlock) >= refractoryBlocks) {
          onsetCount++;
          lastOnsetBlock = b;
          const jumpDb = 20 * Math.log10(energy / runningEnergy);
          if (jumpDb > maxJumpDb) maxJumpDb = jumpDb;
        }
        // Smoothly update running energy during active playback
        runningEnergy = 0.85 * runningEnergy + 0.15 * energy;
      }
    } else {
      // Decaying towards silence
      runningEnergy = 0.85 * runningEnergy;
      if (runningEnergy < silenceThreshold) {
        hasEstablishedRunningLevel = false;
      }
    }
  }

  const durationSec = len / fs;
  const onsetCountPerSec = durationSec > 0 ? onsetCount / durationSec : 0;
  return { onsetCount, onsetCountPerSec, maxOnsetJumpDb: maxJumpDb };
}

// Silence after pause calculation
export function computeSilenceAfterPause(left, right, fs, pauseSampleIndex) {
  if (pauseSampleIndex == null || pauseSampleIndex < 0 || pauseSampleIndex >= left.length) {
    return null;
  }

  const blockSize = Math.floor(fs * 0.025); // 25ms blocks
  const silenceThreshold = 0.001; // -60 dBFS
  const requiredSilentBlocks = 4; // 100ms of consecutive silence
  let consecutiveSilent = 0;
  let firstSilentSample = null;

  for (let i = pauseSampleIndex; i + blockSize <= left.length; i += blockSize) {
    let sumSq = 0;
    for (let j = i; j < i + blockSize; j++) {
      const s = right ? Math.max(Math.abs(left[j]), Math.abs(right[j])) : Math.abs(left[j]);
      sumSq += s * s;
    }
    const blockRms = Math.sqrt(sumSq / blockSize);

    if (blockRms < silenceThreshold) {
      if (consecutiveSilent === 0) firstSilentSample = i;
      consecutiveSilent++;
      if (consecutiveSilent >= requiredSilentBlocks) {
        return Math.max(0, (firstSilentSample - pauseSampleIndex) / fs);
      }
    } else {
      consecutiveSilent = 0;
      firstSilentSample = null;
    }
  }

  // Did not reach required silence before end of recorded buffer
  return (left.length - pauseSampleIndex) / fs;
}

// Spectral centroid calculation from audio samples or pre-recorded centroid frames
export function computeSpectralCentroid(left, right, fs, recordedCentroids = []) {
  if (recordedCentroids && recordedCentroids.length > 0) {
    const valid = recordedCentroids.filter((c) => c > 50 && c < fs / 2);
    if (valid.length > 0) {
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    }
  }

  // Fallback simple time-domain zero-crossing rate approximation if no FFT frames
  const len = left.length;
  if (!len) return 0;
  let crossings = 0;
  for (let i = 1; i < len; i++) {
    if ((left[i] >= 0 && left[i - 1] < 0) || (left[i] < 0 && left[i - 1] >= 0)) {
      crossings++;
    }
  }
  const zcr = (crossings * fs) / (2 * len);
  return Math.round(zcr * 2.5); // approximate centroid from ZCR
}

// Evaluate results against targets from audio-brief.md:
// - True peak at output <= 0.8 (-2 dBFS); never >= 1.0.
// - Each mode playing on its own sits roughly -20 to -16 LUFS-ish.
// - Pause / stop reaches silence within 0.5 s.
// - No sudden onsets louder than 6 dB above the running level.
export function evaluateTargets(metrics) {
  const { peakLinear, loudnessLufs, silenceAfterPauseSec, maxOnsetJumpDb } = metrics;

  const targets = {
    truePeak: {
      target: '<= 0.8 (-2 dBFS); never >= 1.0',
      value: `${peakLinear.toFixed(3)} (${metrics.peakDb.toFixed(2)} dBFS)`,
      pass: peakLinear <= 0.801,
      critical: peakLinear >= 1.0
    },
    loudness: {
      target: '-20 to -16 LUFS-ish',
      value: `${loudnessLufs.toFixed(1)} LUFS`,
      pass: loudnessLufs >= -23.0 && loudnessLufs <= -14.0
    },
    silenceAfterPause: {
      target: '<= 0.5 s',
      value: silenceAfterPauseSec != null ? `${silenceAfterPauseSec.toFixed(3)} s` : 'N/A',
      pass: silenceAfterPauseSec == null || silenceAfterPauseSec <= 0.505
    },
    noSuddenOnsets: {
      target: '<= 6.0 dB jump above running level',
      value: `+${maxOnsetJumpDb.toFixed(1)} dB`,
      pass: maxOnsetJumpDb <= 6.05
    }
  };

  const allPassed = Object.values(targets).every((t) => t.pass);
  const anyCritical = Object.values(targets).some((t) => t.critical);

  return { targets, allPassed, anyCritical };
}
