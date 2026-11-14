// HEARTH — High-Fidelity 16-bit PCM WAV Audio Exporter
// Captures live planetary sonification and exports uncompressed stereo RIFF/WAV.

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samplesL, samplesR, sampleRate) {
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const totalLength = samplesL.length;
  const buffer = new ArrayBuffer(44 + totalLength * blockAlign);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalLength * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, totalLength * blockAlign, true);

  let offset = 44;
  for (let i = 0; i < totalLength; i++) {
    const sL = Math.max(-1, Math.min(1, samplesL[i]));
    view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
    offset += 2;
    const sR = Math.max(-1, Math.min(1, samplesR[i]));
    view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export class AudioExporter {
  constructor(signalAudio) {
    this.signalAudio = signalAudio;
    this.isRecording = false;
    this.recorderNode = null;
  }

  /**
   * Records live planetary audio for a specified duration and triggers browser WAV download.
   * @param {Object} options
   * @param {string} options.regionName
   * @param {number} options.year
   * @param {number} [options.durationSec=6]
   * @param {(progress: number, label: string) => void} [options.onProgress]
   * @returns {Promise<Blob>}
   */
  async recordAndDownload({ regionName = 'Planetary', year = 2026, durationSec = 6, onProgress } = {}) {
    if (this.isRecording) throw new Error('Recording already in progress');

    const ctx = this.signalAudio.ctx || await this.signalAudio.start();
    if (!ctx || ctx.state === 'closed') {
      throw new Error('Audio context not ready');
    }

    if (this.signalAudio.muted) {
      this.signalAudio.setMuted(false);
    }

    this.isRecording = true;
    const sampleRate = ctx.sampleRate;
    const bufferSize = 4096;
    const chunksL = [];
    const chunksR = [];

    // ScriptProcessor tap
    const node = ctx.createScriptProcessor(bufferSize, 2, 2);
    this.recorderNode = node;

    node.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inL = e.inputBuffer.getChannelData(0);
      const inR = e.inputBuffer.getChannelData(1);
      chunksL.push(new Float32Array(inL));
      chunksR.push(new Float32Array(inR));
    };

    // Connect userGain to recorder node
    const tapSource = this.signalAudio.userGain || this.signalAudio.master;
    if (tapSource) {
      tapSource.connect(node);
      node.connect(ctx.destination);
    }

    const startTime = Date.now();
    const durationMs = durationSec * 1000;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        if (onProgress) {
          onProgress(progress, `Recording ${Math.round(progress * 100)}%`);
        }

        if (elapsed >= durationMs) {
          clearInterval(interval);
          this.isRecording = false;

          // Disconnect recorder
          try {
            if (tapSource) tapSource.disconnect(node);
            node.disconnect();
          } catch (_) {}

          // Merge chunks
          const totalSamples = chunksL.reduce((sum, chunk) => sum + chunk.length, 0);
          const flatL = new Float32Array(totalSamples);
          const flatR = new Float32Array(totalSamples);

          let offset = 0;
          for (let i = 0; i < chunksL.length; i++) {
            flatL.set(chunksL[i], offset);
            flatR.set(chunksR[i], offset);
            offset += chunksL[i].length;
          }

          const wavBlob = encodeWAV(flatL, flatR, sampleRate);
          const cleanName = regionName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `HEARTH_${cleanName}_${year}.wav`;

          // Trigger download
          const url = URL.createObjectURL(wavBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 3000);

          if (onProgress) {
            onProgress(1, `Exported ${filename}`);
          }
          resolve(wavBlob);
        }
      }, 100);
    });
  }
}
