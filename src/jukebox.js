// Jukebox card: one horizontal transport for the destination view.
//
// It is a remote control only. Every action goes through the controls and
// APIs the app already has, so the sonification, year handling and audio
// graph behave exactly as before:
//   play / pause  -> app.toggleDestinationAudio()   (same as the Play button)
//   year, prev/next, auto-play -> app.ui.setYear()  (same as the year slider)
//   volume        -> the existing #audio-volume input
// It reads app.audio.state and the existing analyser to show what is playing.

import { REGION_IMAGERY } from './region-imagery.js';

const SPEEDS = { slow: 3000, normal: 1600, fast: 700 };
const SPEED_ORDER = ['slow', 'normal', 'fast'];
const SPEED_LABEL = { slow: '½×', normal: '1×', fast: '2×' };

function $(id) {
  return document.getElementById(id);
}

class Jukebox {
  constructor(root) {
    this.root = root;
    this.el = {
      disc: $('jb-disc'),
      discLabel: $('jb-disc-label'),
      play: $('jb-play'),
      prev: $('jb-prev'),
      next: $('jb-next'),
      status: $('jb-status'),
      title: $('jb-title'),
      sub: $('jb-sub'),
      year: $('jb-year'),
      yearNow: $('jb-year-now'),
      first: $('jb-first'),
      last: $('jb-last'),
      auto: $('jb-auto'),
      speed: $('jb-speed'),
      mute: $('jb-mute'),
      volume: $('jb-volume'),
      meter: $('jb-meter')
    };
    this.speed = 'normal';
    this.autoTimer = 0;
    this.raf = 0;
    this.freq = null;
    this.frame = () => this.tick();

    this.el.play.addEventListener('click', () => this.togglePlay());
    this.el.prev.addEventListener('click', () => this.step(-1));
    this.el.next.addEventListener('click', () => this.step(1));
    this.el.year.addEventListener('input', () => {
      this.stopAuto();
      this.app?.ui.setYear(Number(this.el.year.value));
    });
    this.el.auto.addEventListener('click', () => (this.autoTimer ? this.stopAuto() : this.startAuto()));
    this.el.speed.addEventListener('click', () => {
      const next = SPEED_ORDER[(SPEED_ORDER.indexOf(this.speed) + 1) % SPEED_ORDER.length];
      this.setSpeed(next);
    });
    // Mute goes through the existing Mute button so both stay in sync.
    this.el.mute.addEventListener('click', () => $('audio-mute')?.click());
    // The app's global Left/Right shortcut also steps the year; keep arrow
    // keys on these sliders local so one press moves one step.
    for (const slider of [this.el.year, this.el.volume]) {
      slider.addEventListener('keydown', (event) => {
        if (event.key.startsWith('Arrow')) event.stopPropagation();
      });
    }
    this.el.volume.addEventListener('input', () => {
      const source = $('audio-volume');
      if (!source) return;
      source.value = this.el.volume.value;
      source.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Show the card only while a destination is open: that is the only view
    // where the app plays destination audio.
    new MutationObserver(() => this.syncVisibility()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.syncVisibility();
  }

  get app() {
    return window.__hearth;
  }

  syncVisibility() {
    const open = document.body.classList.contains('destination-open') && Boolean(this.app?.ui);
    if (open === !this.root.hidden) return;
    this.root.hidden = !open;
    if (open) {
      this.syncStatic();
      if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    } else {
      this.stopAuto();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  bounds() {
    const ui = this.app?.ui;
    return ui ? ui.regionYearBounds(ui.activeRegion) : { first: 1985, last: 2025 };
  }

  syncStatic() {
    const ui = this.app?.ui;
    const region = ui?.activeRegion;
    const { first, last } = this.bounds();
    this.el.year.min = String(first);
    this.el.year.max = String(last);
    this.el.first.textContent = String(first);
    this.el.last.textContent = String(last);
    this.el.title.textContent = region?.name || 'Choose a place';
    this.el.discLabel.textContent = (region?.name || 'H').trim().charAt(0);
    // Artwork: the place's NASA satellite plate, like album art.
    const plate = region ? REGION_IMAGERY[region.id]?.file : null;
    this.el.disc.style.backgroundImage = plate ? `url("./assets/textures/${plate}")` : '';
    this.el.disc.toggleAttribute('data-has-art', Boolean(plate));
    this.regionId = region?.id;
  }

  togglePlay() {
    const app = this.app;
    if (!app) return;
    // Pausing also stops "Play years", so the timeline never runs silently.
    if (app.audio?.state?.status === 'playing') this.stopAuto();
    if (typeof app.toggleDestinationAudio === 'function') app.toggleDestinationAudio();
  }

  step(delta) {
    const ui = this.app?.ui;
    if (!ui) return;
    this.stopAuto();
    ui.setYear(Number(ui.activeYear) + delta);
  }

  startAuto() {
    const ui = this.app?.ui;
    if (!ui) return;
    const { first, last } = this.bounds();
    if (Number(ui.activeYear) >= last) ui.setYear(first, true);
    // Start the music if it is not already playing.
    if (this.app.audio?.state?.status !== 'playing') this.togglePlay();
    this.el.auto.setAttribute('aria-pressed', 'true');
    this.root.dataset.auto = '';
    this.scheduleAuto();
  }

  scheduleAuto() {
    window.clearTimeout(this.autoTimer);
    this.autoTimer = window.setTimeout(() => {
      const ui = this.app?.ui;
      if (!ui) return this.stopAuto();
      const { last } = this.bounds();
      const next = Number(ui.activeYear) + 1;
      if (next > last) return this.stopAuto();
      ui.stopCompare?.();
      // `true` = automatic step: no UI tick and no spoken summary per year.
      ui.setYear(next, true);
      this.scheduleAuto();
    }, SPEEDS[this.speed]);
  }

  stopAuto() {
    window.clearTimeout(this.autoTimer);
    this.autoTimer = 0;
    this.el.auto.setAttribute('aria-pressed', 'false');
    delete this.root.dataset.auto;
  }

  setSpeed(speed) {
    if (!SPEEDS[speed]) return;
    this.speed = speed;
    this.el.speed.textContent = SPEED_LABEL[speed];
    this.el.speed.setAttribute('aria-label', `Year speed: ${speed}`);
    this.el.speed.title = `Year speed: ${speed} (${SPEEDS[speed] / 1000}s per year)`;
    if (this.autoTimer) this.scheduleAuto();
  }

  tick() {
    this.raf = requestAnimationFrame(this.frame);
    const app = this.app;
    const ui = app?.ui;
    if (!ui) return;
    if (ui.activeRegion?.id !== this.regionId) this.syncStatic();

    const state = app.audio?.state || {};
    const playing = state.status === 'playing';
    if (this.playing !== playing) {
      this.playing = playing;
      this.root.toggleAttribute('data-playing', playing);
      this.el.play.setAttribute('aria-pressed', String(playing));
      this.el.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    const labels = { playing: 'Now playing', paused: 'Paused', ready: 'Ready', idle: 'Ready', blocked: 'Tap play to start audio', unavailable: 'Audio unavailable' };
    const statusText = `${labels[state.status] || 'Ready'}${state.muted ? ' · muted' : ''}`;
    if (this.el.status.textContent !== statusText) this.el.status.textContent = statusText;
    const sub = state.soundscape || ui.activeRegion?.short || '';
    if (this.el.sub.textContent !== sub) this.el.sub.textContent = sub;

    const year = String(ui.activeYear ?? '');
    if (this.el.year.value !== year && document.activeElement !== this.el.year) this.el.year.value = year;
    if (this.el.yearNow.textContent !== year) this.el.yearNow.textContent = year;
    const { first, last } = this.bounds();
    this.el.year.style.setProperty('--fill', `${((Number(year) - first) / Math.max(1, last - first)) * 100}%`);

    const muted = Boolean(state.muted);
    if (this.muted !== muted) {
      this.muted = muted;
      this.root.toggleAttribute('data-muted', muted);
      this.el.mute.setAttribute('aria-pressed', String(muted));
      this.el.mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }

    const source = $('audio-volume');
    if (source && document.activeElement !== this.el.volume && this.el.volume.value !== source.value) this.el.volume.value = source.value;
    this.el.volume.style.setProperty('--fill', `${Number(this.el.volume.value) * 100}%`);

    this.drawMeter(playing);
  }

  drawMeter(playing) {
    const canvas = this.el.meter;
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    g.clearRect(0, 0, width, height);
    const analyser = this.app?.audio?.analyser;
    const bars = 9;
    if (analyser && !this.freq) this.freq = new Uint8Array(analyser.frequencyBinCount);
    if (analyser && playing) analyser.getByteFrequencyData(this.freq);
    const accent = getComputedStyle(this.root).getPropertyValue('--accent').trim() || '#38bdf8';
    g.fillStyle = accent;
    const w = width / bars;
    for (let i = 0; i < bars; i++) {
      const v = playing && this.freq ? this.freq[Math.min(this.freq.length - 1, 1 + i * 2)] / 255 : 0;
      const h = Math.max(2, v * height);
      g.globalAlpha = 0.35 + 0.65 * v;
      g.fillRect(i * w + 1, height - h, w - 2, h);
    }
    g.globalAlpha = 1;
  }
}

const root = document.getElementById('jukebox');
if (root) window.__hearthJukebox = new Jukebox(root);
