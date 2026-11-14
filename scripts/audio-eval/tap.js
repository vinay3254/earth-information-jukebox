// Browser injection script that patches AudioNode.prototype.connect
// to tap every AudioDestinationNode with an AnalyserNode and capture PCM audio.

export const BROWSER_TAP_SCRIPT = `
(() => {
  if (window.__evalHarness) return;

  const harness = {
    recording: false,
    scenarioName: '',
    sampleRate: 48000,
    startTime: 0,
    pauseTime: null,
    pauseSampleIndex: null,
    totalSamplesRecorded: 0,
    leftChunks: [],
    rightChunks: [],
    centroids: [],
    contexts: new Set(),

    initContext(ctx, dest) {
      // Offline contexts (e.g. Tone.Reverb rendering its impulse response) are never heard; skip them.
      if (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) return;
      if (ctx._audioEvalTapped) return;
      ctx._audioEvalTapped = true;
      harness.contexts.add(ctx);
      harness.sampleRate = ctx.sampleRate || 48000;

      // Master tap bus for this AudioContext
      const tapBus = ctx.createGain();
      tapBus.gain.value = 1.0;
      ctx._evalTapBus = tapBus;

      // AnalyserNode tap
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      tapBus.connect(analyser);
      ctx._evalAnalyser = analyser;

      // MediaStreamDestination tap
      if (typeof ctx.createMediaStreamDestination === 'function') {
        const msd = ctx.createMediaStreamDestination();
        tapBus.connect(msd);
        ctx._evalMsd = msd;
      }

      // ScriptProcessor for lossless PCM audio capture
      const bufferSize = 4096;
      const sp = ctx.createScriptProcessor(bufferSize, 2, 2);
      sp._isEvalTap = true;
      const freqData = new Float32Array(analyser.frequencyBinCount);

      sp.onaudioprocess = (e) => {
        // Output silence to destination so tap does not duplicate sound
        for (let c = 0; c < e.outputBuffer.numberOfChannels; c++) {
          e.outputBuffer.getChannelData(c).fill(0);
        }

        if (!harness.recording) return;

        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : left;

        // Copy channel data
        harness.leftChunks.push(new Float32Array(left));
        harness.rightChunks.push(new Float32Array(right));
        harness.totalSamplesRecorded += left.length;

        // Measure spectral centroid from AnalyserNode
        analyser.getFloatFrequencyData(freqData);
        let num = 0, den = 0;
        const binWidth = ctx.sampleRate / analyser.fftSize;
        for (let i = 0; i < freqData.length; i++) {
          if (freqData[i] > -100) {
            const mag = Math.pow(10, freqData[i] / 20);
            num += (i * binWidth) * mag;
            den += mag;
          }
        }
        if (den > 1e-6) {
          harness.centroids.push(num / den);
        }
      };

      tapBus.connect(sp);
      origConnect.call(sp, dest);
    },

    start(name) {
      harness.recording = true;
      harness.scenarioName = name || 'default';
      harness.startTime = performance.now();
      harness.pauseTime = null;
      harness.pauseSampleIndex = null;
      harness.totalSamplesRecorded = 0;
      harness.leftChunks = [];
      harness.rightChunks = [];
      harness.centroids = [];
    },

    markPause() {
      if (!harness.recording) return;
      harness.pauseTime = performance.now();
      harness.pauseSampleIndex = harness.totalSamplesRecorded;
    },

    stop() {
      harness.recording = false;
      const durationSec = (performance.now() - harness.startTime) / 1000;

      // Concatenate Float32 chunks
      const totalLen = harness.totalSamplesRecorded;
      const leftFull = new Float32Array(totalLen);
      const rightFull = new Float32Array(totalLen);

      let offset = 0;
      for (let i = 0; i < harness.leftChunks.length; i++) {
        const l = harness.leftChunks[i];
        const r = harness.rightChunks[i];
        leftFull.set(l, offset);
        rightFull.set(r, offset);
        offset += l.length;
      }

      // Convert to base64 Float32 buffers for transfer to Node
      const leftBuf = new Uint8Array(leftFull.buffer);
      const rightBuf = new Uint8Array(rightFull.buffer);

      let leftB64 = '';
      let rightB64 = '';
      const CHUNK_SIZE = 0x8000;
      for (let i = 0; i < leftBuf.length; i += CHUNK_SIZE) {
        leftB64 += String.fromCharCode.apply(null, leftBuf.subarray(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < rightBuf.length; i += CHUNK_SIZE) {
        rightB64 += String.fromCharCode.apply(null, rightBuf.subarray(i, i + CHUNK_SIZE));
      }

      const result = {
        scenario: harness.scenarioName,
        sampleRate: harness.sampleRate,
        durationSec,
        pauseSampleIndex: harness.pauseSampleIndex,
        centroids: harness.centroids,
        leftB64: btoa(leftB64),
        rightB64: btoa(rightB64),
        totalSamples: totalLen
      };

      // Clear memory
      harness.leftChunks = [];
      harness.rightChunks = [];
      harness.centroids = [];

      return result;
    }
  };

  window.__evalHarness = harness;

  const origConnect = AudioNode.prototype.connect;
  const origDisconnect = AudioNode.prototype.disconnect;

  AudioNode.prototype.connect = function(dest, ...rest) {
    if (this._isEvalTap) return origConnect.apply(this, [dest, ...rest]);

    // Check if connecting to an AudioDestinationNode or context.destination
    if (dest && (dest instanceof AudioDestinationNode || (this.context && dest === this.context.destination))) {
      const ctx = this.context;
      harness.initContext(ctx, dest);

      if (!this._evalTappedBuses) this._evalTappedBuses = new Set();
      const bus = ctx._evalTapBus;
      if (bus && !this._evalTappedBuses.has(bus)) {
        this._evalTappedBuses.add(bus);
        try { origConnect.call(this, bus); } catch (e) { console.warn('Tap connect error', e); }
      }
    }
    return origConnect.apply(this, [dest, ...rest]);
  };

  AudioNode.prototype.disconnect = function(...args) {
    if (this._evalTappedBuses && this.context?._evalTapBus) {
      if (this._evalTappedBuses.has(this.context._evalTapBus)) {
        try { origDisconnect.call(this, this.context._evalTapBus); } catch (e) {}
        this._evalTappedBuses.delete(this.context._evalTapBus);
      }
    }
    return origDisconnect.apply(this, args);
  };
})();
`;
