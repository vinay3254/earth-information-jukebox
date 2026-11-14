#!/usr/bin/env node
/**
 * Earth Information Jukebox — Audio Evaluation & Measurement Harness
 * Usage: node scripts/audio-eval/run.mjs [scenario...] [--json] [--url http://localhost:5173]
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

import { BROWSER_TAP_SCRIPT } from './tap.js';
import { SCENARIOS } from './scenarios.js';
import { encodeWav } from './wav.js';
import {
  computeTruePeak,
  computeRmsDb,
  computeShortTermLoudness,
  computeOnsets,
  computeSilenceAfterPause,
  computeSpectralCentroid,
  evaluateTargets
} from './metrics.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Locate Playwright Core
function getPlaywright() {
  const searchPaths = [
    '/tmp/eij-pw/node_modules/playwright-core',
    'playwright-core'
  ];
  for (const p of searchPaths) {
    try {
      const pw = require(p);
      if (pw && pw.chromium) return pw.chromium;
    } catch {
      // continue
    }
  }
  throw new Error(
    'playwright-core not found. Please install it in /tmp/eij-pw:\\n  npm i --prefix /tmp/eij-pw playwright-core@1.56.1'
  );
}

// 2. Locate Chrome/Chromium executable
function getChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    '/opt/google/chrome/chrome',
    '/home/vinay/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome'
  ];

  // Also check standard ms-playwright cache directories if any
  const homeCache = path.join(process.env.HOME || '/home/vinay', '.cache/ms-playwright');
  if (fs.existsSync(homeCache)) {
    try {
      const dirs = fs.readdirSync(homeCache).filter((d) => d.startsWith('chromium-'));
      for (const d of dirs) {
        const p = path.join(homeCache, d, 'chrome-linux64/chrome');
        if (fs.existsSync(p)) candidates.push(p);
      }
    } catch {
      // ignore
    }
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('Could not find Chrome executable at /opt/google/chrome/chrome or ms-playwright cache.');
}

// 3. Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  let isJson = false;
  let targetUrl = 'http://localhost:5173';
  let outDir = '/tmp/eij-audio';
  const scenariosToRun = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') {
      isJson = true;
    } else if (a === '--url' && args[i + 1]) {
      targetUrl = args[++i];
    } else if (a === '--out' && args[i + 1]) {
      outDir = args[++i];
    } else if (a === '--help' || a === '-h') {
      console.log(`Earth Information Jukebox — Audio Evaluation Harness

Usage:
  node scripts/audio-eval/run.mjs [scenario...] [--json] [--url URL]

Available scenarios:
  space          Solar system: planet focus chimes and orbit chimes
  earth          Earth: region data synth, sweep, and compare
  lab            Frame Lab: video sonification, track switching, explore
  space-planets  Planet focus chime ring
  space-chimes   Orbit chimes on/off
  earth-play     Data synth play single year
  earth-sweep    Data synth all-years sweep
  earth-compare  Data synth compare mode
  lab-play       Frame Lab video play/pause
  lab-tracks     Cycle Frame Lab tracks 1-4
  lab-explore    Frame Lab explore by hand

Options:
  --json         Print pure JSON report
  --url URL      Dev server URL (default: http://localhost:5173)
  --out DIR      Output directory for WAV recordings (default: /tmp/eij-audio)
`);
      process.exit(0);
    } else if (!a.startsWith('-')) {
      scenariosToRun.push(a);
    }
  }

  const selectedScenarios = scenariosToRun.length > 0 ? scenariosToRun : ['space', 'earth', 'lab'];
  return { isJson, targetUrl, outDir, selectedScenarios };
}

// Helper to decode Base64 Float32Array
function decodeFloat32Base64(b64) {
  if (!b64) return new Float32Array(0);
  const raw = Buffer.from(b64, 'base64');
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

async function main() {
  const { isJson, targetUrl, outDir, selectedScenarios } = parseArgs();

  // Validate selected scenarios
  for (const s of selectedScenarios) {
    if (!SCENARIOS[s]) {
      console.error(`Unknown scenario: "${s}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
      process.exit(1);
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  const chromium = getPlaywright();
  const execPath = getChromeExecutable();

  if (!isJson) {
    console.log(`Starting audio eval harness on ${targetUrl}`);
    console.log(`Using Chrome: ${execPath}`);
    console.log(`Scenarios: ${selectedScenarios.join(', ')}\\n`);
  }

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const results = {};
  let overallPassed = true;

  try {
    const page = await browser.newPage();
    await page.addInitScript(BROWSER_TAP_SCRIPT);

    if (!isJson) console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    for (const name of selectedScenarios) {
      if (!isJson) console.log(`Running scenario: [${name}]...`);

      const raw = await SCENARIOS[name](page);
      const fsRate = raw.sampleRate || 48000;
      const left = decodeFloat32Base64(raw.leftB64);
      const right = decodeFloat32Base64(raw.rightB64);

      // Save WAV file
      const wavBuffer = encodeWav(left, right, fsRate);
      const wavPath = path.join(outDir, `${name}.wav`);
      fs.writeFileSync(wavPath, wavBuffer);

      // Compute metrics
      const peak = computeTruePeak(left, right);
      const rmsDb = computeRmsDb(left, right);
      const loudnessLufs = computeShortTermLoudness(left, right, fsRate);
      const onsets = computeOnsets(left, right, fsRate);
      const silenceAfterPauseSec = computeSilenceAfterPause(left, right, fsRate, raw.pauseSampleIndex);
      const spectralCentroidHz = computeSpectralCentroid(left, right, fsRate, raw.centroids);

      const metrics = {
        scenario: name,
        durationSec: Number(raw.durationSec.toFixed(2)),
        sampleRate: fsRate,
        truePeakLinear: Number(peak.peakLinear.toFixed(4)),
        truePeakDb: Number(peak.peakDb.toFixed(2)),
        rmsDb: Number(rmsDb.toFixed(2)),
        loudnessLufs: Number(loudnessLufs.toFixed(1)),
        onsetCount: onsets.onsetCount,
        onsetCountPerSec: Number(onsets.onsetCountPerSec.toFixed(2)),
        maxOnsetJumpDb: Number(onsets.maxOnsetJumpDb.toFixed(1)),
        spectralCentroidHz: Math.round(spectralCentroidHz),
        silenceAfterPauseSec: silenceAfterPauseSec != null ? Number(silenceAfterPauseSec.toFixed(3)) : null,
        wavFile: wavPath
      };

      const evaluation = evaluateTargets({
        peakLinear: metrics.truePeakLinear,
        peakDb: metrics.truePeakDb,
        loudnessLufs: metrics.loudnessLufs,
        silenceAfterPauseSec: metrics.silenceAfterPauseSec,
        maxOnsetJumpDb: metrics.maxOnsetJumpDb
      });

      metrics.targets = evaluation.targets;
      metrics.passed = evaluation.allPassed;
      metrics.critical = evaluation.anyCritical;

      if (!evaluation.allPassed) overallPassed = false;
      results[name] = metrics;

      if (!isJson) {
        console.log(`  -> Duration: ${metrics.durationSec}s | True Peak: ${metrics.truePeakLinear} (${metrics.truePeakDb} dBFS) | RMS: ${metrics.rmsDb} dBFS`);
        console.log(`  -> Loudness: ${metrics.loudnessLufs} LUFS | Centroid: ${metrics.spectralCentroidHz} Hz | Onsets: ${metrics.onsetCountPerSec}/s (max jump: +${metrics.maxOnsetJumpDb} dB)`);
        console.log(`  -> Silence after pause: ${metrics.silenceAfterPauseSec != null ? metrics.silenceAfterPauseSec + 's' : 'N/A'}`);
        console.log(`  -> WAV captured: ${wavPath}`);
        for (const [key, t] of Object.entries(metrics.targets)) {
          const status = t.pass ? 'PASS' : 'FAIL';
          console.log(`     [${status}] ${key}: ${t.value} (target: ${t.target})`);
        }
        console.log('');
      }
    }
  } catch (err) {
    console.error('Error running audio eval harness:', err);
    await browser.close().catch(() => {});
    process.exit(1);
  } finally {
    await browser.close().catch(() => {});
  }

  const finalReport = {
    timestamp: new Date().toISOString(),
    overallPassed,
    results
  };

  if (isJson) {
    console.log(JSON.stringify(finalReport, null, 2));
  } else {
    console.log('----------------------------------------------------');
    console.log(`OVERALL STATUS: ${overallPassed ? 'ALL TARGETS PASSED' : 'TARGET FAILURES DETECTED'}`);
    console.log('----------------------------------------------------');
  }

  process.exit(0);
}

main();
