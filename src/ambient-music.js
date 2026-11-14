// Soothing background music that runs for the whole session.
//
// A slow, warm pad generated live (no audio files): four chord voices that
// glide between Am9 -> Fmaj7 -> Cmaj7 -> G6/9 every ~14 s, a breathing
// low-pass filter, long reverb and a faint ocean-like noise bed. There are no
// percussive events, so nothing ticks or beeps.
//
// Behaviour:
//   - starts with the app; browsers only allow sound after the first click or
//     key press, so it fades in on that first interaction
//   - fades to a faint level while a destination is open (the place's own
//     sonification takes over) and back up on returning to the solar system
//   - follows the app's Mute button and volume slider
//
// It owns its own AudioContext and does not touch the sonification engine.

const FULL_LEVEL = 0.16;
const DUCKED_LEVEL = 0.03; // faint while a place is open
const CHORD_SECONDS = 14;
const GLIDE = 2.4;

// Voices low to high; each chord gives one frequency per voice.
const CHORDS = [
  [110.0, 164.81, 261.63, 392.0], // Am9 colour: A2 E3 C4 G4
  [87.31, 130.81, 220.0, 329.63], // Fmaj7: F2 C3 A3 E4
  [130.81, 196.0, 329.63, 493.88], // Cmaj7: C3 G3 E4 B4
  [98.0, 146.83, 246.94, 329.63] // G6/9: G2 D3 B3 E4
];
const VOICE_LEVELS = [0.32, 0.26, 0.2, 0.13];

function makeImpulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function makeSoftNoise(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    // Leaky-integrated white noise: brown-ish, soft like distant surf.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

class AmbientMusic {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.chordIndex = 0;
    this.chordTimer = 0;
    this.ducked = false;
    this.userScale = 1;
    this.onFirstGesture = () => this.start();
    window.addEventListener('pointerdown', this.onFirstGesture, { once: true, capture: true });
    window.addEventListener('keydown', this.onFirstGesture, { once: true, capture: true });
    // If the browser already allows sound (e.g. a returning visitor), begin now.
    this.tryAutostart();
  }

  async tryAutostart() {
    try {
      this.build();
      if (this.ctx.state === 'running') this.begin();
    } catch (error) {
      // Web Audio unavailable: the app works without background music.
    }
  }

  build() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 5.5, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet);
    wet.connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 780;
    this.filter.Q.value = 0.3;
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    this.filter.connect(dry);
    dry.connect(this.master);
    this.filter.connect(reverb);

    // The filter breathes slowly so the held chord never sounds static.
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.045;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 240;
    breath.connect(breathDepth);
    breathDepth.connect(this.filter.frequency);
    breath.start();

    this.voices = CHORDS[0].map((freq, i) => {
      const gain = ctx.createGain();
      gain.gain.value = VOICE_LEVELS[i];
      gain.connect(this.filter);
      const oscs = [['sine', 0], ['triangle', 5], ['sine', -6]].map(([type, cents], j) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = cents;
        const level = ctx.createGain();
        level.gain.value = j === 1 ? 0.35 : 0.5;
        osc.connect(level);
        level.connect(gain);
        osc.start();
        return osc;
      });
      // Each voice swells on its own slow cycle.
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.03 + i * 0.011;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = VOICE_LEVELS[i] * 0.35;
      swell.connect(swellDepth);
      swellDepth.connect(gain.gain);
      swell.start();
      return { oscs };
    });

    // Faint surf bed under the pad.
    const noise = ctx.createBufferSource();
    noise.buffer = makeSoftNoise(ctx, 6);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 420;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    const surf = ctx.createOscillator();
    surf.frequency.value = 0.08;
    const surfDepth = ctx.createGain();
    surfDepth.gain.value = 0.035;
    surf.connect(surfDepth);
    surfDepth.connect(noiseGain.gain);
    surf.start();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    noiseGain.connect(reverb);
    noise.start();
  }

  async start() {
    window.removeEventListener('pointerdown', this.onFirstGesture, { capture: true });
    window.removeEventListener('keydown', this.onFirstGesture, { capture: true });
    try {
      this.build();
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.begin();
    } catch (error) {
      // Leave the app silent rather than failing.
    }
  }

  begin() {
    if (this.started) return;
    this.started = true;
    this.scheduleChords();
    // Duck while a destination is open.
    new MutationObserver(() => this.syncDuck()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // Follow the app's Mute and volume.
    this.followTimer = window.setInterval(() => this.followAppVolume(), 250);
    this.ducked = document.body.classList.contains('destination-open');
    this.followAppVolume(true);
  }

  scheduleChords() {
    this.chordTimer = window.setInterval(() => {
      this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      const now = this.ctx.currentTime;
      CHORDS[this.chordIndex].forEach((freq, i) => {
        for (const osc of this.voices[i].oscs) osc.frequency.setTargetAtTime(freq, now, GLIDE);
      });
    }, CHORD_SECONDS * 1000);
  }

  syncDuck() {
    const ducked = document.body.classList.contains('destination-open');
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    this.applyLevel(ducked ? 1.6 : 2.8);
  }

  followAppVolume(initial = false) {
    const state = window.__hearth?.audio?.state;
    const scale = state ? (state.muted ? 0 : Number(state.volume ?? 1)) : 1;
    if (!initial && Math.abs(scale - this.userScale) < 0.005) return;
    this.userScale = scale;
    this.applyLevel(initial ? 6 : 0.3);
  }

  applyLevel(seconds) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const target = (this.ducked ? DUCKED_LEVEL : FULL_LEVEL) * this.userScale;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    // Exponential-feeling fade without hitting zero (muted is near-silent).
    this.master.gain.setTargetAtTime(Math.max(0.0001, target), now, seconds / 3);
  }
}

window.__hearthAmbient = new AmbientMusic();
