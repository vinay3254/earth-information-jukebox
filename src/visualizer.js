// HEARTH — Live Audio Frequency Visualizer / Oscilloscope HUD
// Renders real-time acoustic spectrum and waveform with high-efficiency Canvas 2D.

export class AudioVisualizer {
  constructor(canvas, signalAudio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.signalAudio = signalAudio;
    this.animId = null;
    this.dataArray = null;
    this.timeDomainArray = null;
    this.running = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(120, Math.floor(rect.width || 180));
    const height = Math.max(28, Math.floor(rect.height || 36));

    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.width = width;
    this.height = height;
    this.ctx.scale(this.dpr, this.dpr);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.drawIdle();
  }

  loop() {
    if (!this.running) return;
    this.draw();
    this.animId = requestAnimationFrame(() => this.loop());
  }

  drawIdle() {
    const { ctx, width, height } = this;
    if (!ctx || !width || !height) return;

    ctx.clearRect(0, 0, width, height);

    // Subtle horizontal baseline
    ctx.strokeStyle = document.body.classList.contains('high-contrast')
      ? 'rgba(255, 238, 0, 0.4)'
      : 'rgba(120, 200, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  draw() {
    const { ctx, width, height } = this;
    if (!ctx || !width || !height) return;

    const analyser = this.signalAudio?.analyser;
    const isMuted = this.signalAudio?.muted;
    const isPlaying = this.signalAudio?.ready && this.signalAudio?.hasRun && !isMuted;

    if (!analyser || !isPlaying) {
      this.drawIdle();
      return;
    }

    if (!this.dataArray || this.dataArray.length !== analyser.frequencyBinCount) {
      this.dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.timeDomainArray = new Uint8Array(analyser.frequencyBinCount);
    }

    analyser.getByteFrequencyData(this.dataArray);
    analyser.getByteTimeDomainData(this.timeDomainArray);

    ctx.clearRect(0, 0, width, height);

    const isHighContrast = document.body.classList.contains('high-contrast');
    const barCount = Math.min(24, this.dataArray.length);
    const gap = 2;
    const barWidth = (width - (barCount - 1) * gap) / barCount;

    // Draw Frequency Bars
    for (let i = 0; i < barCount; i++) {
      const val = this.dataArray[i] / 255;
      const barHeight = Math.max(2, val * (height - 4));
      const x = i * (barWidth + gap);
      const y = height - barHeight;

      if (isHighContrast) {
        ctx.fillStyle = val > 0.65 ? '#00FFFF' : '#FFEE00';
      } else {
        const grad = ctx.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, 'rgba(40, 160, 220, 0.4)');
        grad.addColorStop(0.7, 'rgba(80, 220, 180, 0.85)');
        grad.addColorStop(1, 'rgba(210, 255, 230, 1.0)');
        ctx.fillStyle = grad;
      }

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Draw Smooth Oscilloscope Center Wave
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isHighContrast
      ? 'rgba(0, 255, 255, 0.9)'
      : 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();

    const sliceWidth = width / this.timeDomainArray.length;
    let wx = 0;
    for (let i = 0; i < this.timeDomainArray.length; i++) {
      const v = this.timeDomainArray[i] / 128.0;
      const wy = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(wx, wy);
      } else {
        ctx.lineTo(wx, wy);
      }
      wx += sliceWidth;
    }
    ctx.stroke();
  }
}
