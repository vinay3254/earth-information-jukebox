// Live ISS Mode: a real-time layer that runs alongside the historical NASA EIC
// sonification without changing it.
//
// Every 5 seconds it fetches the International Space Station's live position.
//
// Sound (own AudioContext, separate from SignalAudio):
//   latitude  -> pitch. 220 Hz + (90 - |lat|) * 4 is snapped to the nearest
//                A-minor pentatonic note, so it rises toward the equator and
//                falls toward the poles while staying in HEARTH's scale.
//                A soft pad (root, fifth, sub-octave) holds that note.
//   longitude -> stereo pan, lon / 180 (-1 hard left .. +1 hard right),
//                via a StereoPannerNode between the pad and the output.
//   each fix  -> a short bell ping, so every live update is audible.
//   nearest   -> the ambient recording of the HEARTH destination closest to
//   place        the ground track, crossfading as the ISS moves on.
// All changes glide with setTargetAtTime (~1 s) so nothing clicks or jumps.
//
// Visual: a glowing ISS marker and a short orbit trail on the 3D Earth, and,
// while the app is in its solar or orbit view, the globe eases round so the
// ISS faces the camera. It only reads the app (window.__hearth) and adds its
// own objects; it never changes the data-to-music engine or its recordings.

import * as THREE from 'three';
import { REGIONS } from './regions.js';
import { REGION_ENVIRONMENT_AUDIO } from './signal-audio.js';
import { latLonToVector3 } from './utils.js';

const PRIMARY_URL = 'http://api.open-notify.org/iss-now.json';
// open-notify is HTTP only, which an HTTPS page may not fetch (mixed content).
// wheretheiss.at serves the same live position over HTTPS.
const FALLBACK_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

const POLL_MS = 5000;
const REQUEST_TIMEOUT_MS = 4000;
const GLIDE = 0.33; // setTargetAtTime constant: settles in about 1 s
const FADE_SECONDS = 0.8;
const PAD_LEVEL = 0.11;
const AMBIENT_LEVEL = 0.32;
const TRAIL_POINTS = 72; // 6 minutes of 5 s fixes
const ISS_ALTITUDE = 1.07; // ~420 km over a 6371 km Earth, exaggerated slightly to clear the clouds

// A-minor pentatonic from A3 (220 Hz) up two octaves.
const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24].map((s) => 220 * Math.pow(2, s / 12));
const NOTE_NAMES = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

export function latitudeToFrequency(latitude) {
  return 220 + (90 - Math.abs(latitude)) * 4;
}

export function longitudeToPan(longitude) {
  return Math.max(-1, Math.min(1, longitude / 180));
}

function snapToScale(frequency) {
  let best = 0;
  for (let i = 1; i < PENTATONIC.length; i++) {
    if (Math.abs(Math.log(PENTATONIC[i] / frequency)) < Math.abs(Math.log(PENTATONIC[best] / frequency))) best = i;
  }
  return { frequency: PENTATONIC[best], name: NOTE_NAMES[best] };
}

function greatCircleKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestRegion(lat, lon) {
  let best = null;
  let bestKm = Infinity;
  for (const region of REGIONS) {
    const km = greatCircleKm(lat, lon, region.lat, region.lon);
    if (km < bestKm) {
      bestKm = km;
      best = region;
    }
  }
  return { region: best, km: bestKm };
}

function formatCoord(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchIssPosition() {
  if (window.location.protocol !== 'https:') {
    try {
      const data = await fetchJson(PRIMARY_URL);
      const latitude = Number(data?.iss_position?.latitude);
      const longitude = Number(data?.iss_position?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude, source: 'open-notify' };
    } catch (error) {
      // Fall through to the HTTPS feed.
    }
  }
  const data = await fetchJson(FALLBACK_URL);
  const latitude = Number(data?.latitude);
  const longitude = Number(data?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Malformed ISS position');
  return { latitude, longitude, source: 'wheretheiss.at' };
}

function makeImpulse(ctx, seconds = 2.6, decay = 2.6) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(160,240,255,0.85)');
  grd.addColorStop(0.5, 'rgba(56,189,248,0.25)');
  grd.addColorStop(1, 'rgba(56,189,248,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- audio

class IssVoice {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.ambient = null; // { file, source, gain }
  }

  async open() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.build();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0.42;
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.master);

    // Pad -> lowpass -> panner -> master (+ reverb send)
    this.panner = ctx.createStereoPanner();
    this.panner.connect(this.master);
    this.panner.connect(this.reverb);

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.4;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = PAD_LEVEL;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.panner);

    const voice = (type, ratio, level, detune = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.value = level;
      osc.connect(gain);
      gain.connect(this.padFilter);
      osc.start();
      return { osc, ratio };
    };
    this.voices = [
      voice('triangle', 1, 0.42),
      voice('sine', 1, 0.3, 7),
      voice('sine', 1.5, 0.26),
      voice('sine', 0.5, 0.36)
    ];
    // Slow breathing on the pad filter so the held note feels alive.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.09;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 260;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.padFilter.frequency);
    this.lfo.start();

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = AMBIENT_LEVEL;
    this.ambientBus.connect(this.master);
  }

  fadeIn() {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    this.master.gain.exponentialRampToValueAtTime(1, now + FADE_SECONDS);
  }

  fadeOut() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + FADE_SECONDS);
    window.setTimeout(() => {
      if (this.master.gain.value < 0.01) {
        this.stopAmbient(0);
        if (ctx.state === 'running') ctx.suspend().catch(() => {});
      }
    }, FADE_SECONDS * 1000 + 150);
  }

  setPosition(note, pan) {
    const now = this.ctx.currentTime;
    for (const v of this.voices) v.osc.frequency.setTargetAtTime(note * v.ratio, now, GLIDE);
    this.panner.pan.setTargetAtTime(pan, now, GLIDE);
  }

  // Short bell on every live fix: the note an octave up plus a soft partial.
  ping(note) {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    gain.connect(this.panner);
    for (const [ratio, level] of [[2, 1], [3, 0.28], [4.2, 0.12]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note * ratio;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(gain);
      osc.start(t);
      osc.stop(t + 1.7);
    }
  }

  async loadBuffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    const response = await fetch(`./assets/audio/${file}`);
    if (!response.ok) throw new Error(`Missing ${file}`);
    const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(file, buffer);
    return buffer;
  }

  async setAmbient(file, level) {
    if (this.ambient?.file === file) return;
    this.stopAmbient(1.5);
    if (!file) return;
    this.ambient = { file, source: null, gain: null };
    const pending = this.ambient;
    try {
      const buffer = await this.loadBuffer(file);
      if (this.ambient !== pending || !this.ctx) return;
      const now = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 1.8);
      source.connect(gain);
      gain.connect(this.ambientBus);
      source.start(now, Math.random() * Math.max(0, buffer.duration - 1));
      pending.source = source;
      pending.gain = gain;
    } catch (error) {
      if (this.ambient === pending) this.ambient = null;
    }
  }

  stopAmbient(seconds) {
    const old = this.ambient;
    this.ambient = null;
    if (!old?.source || !this.ctx) return;
    const now = this.ctx.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, seconds));
    try {
      old.source.stop(now + Math.max(0.05, seconds) + 0.05);
    } catch (error) {
      // Already stopped.
    }
  }
}

// ---------------------------------------------------------------- 3D marker

class IssMarker {
  constructor() {
    this.app = null;
    this.group = null;
    this.trail = [];
    this.target = null; // spin-local unit vector of the latest fix
    this.steer = false;
    this.raf = 0;
    this.lastFrame = 0;
    this.frame = (now) => this.tick(now);
  }

  attach() {
    const app = window.__hearth;
    if (!app?.earth?.spin) return false;
    if (this.group) return true;
    this.app = app;
    const R = app.earth.radius;

    this.group = new THREE.Group();
    this.group.name = 'iss-live-marker';

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false
    }));
    glow.scale.setScalar(R * 0.42);
    this.glow = glow;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.018, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe0faff, toneMapped: false })
    );
    this.head = new THREE.Group();
    this.head.add(glow, core);
    this.group.add(this.head);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    this.trailGeometry.setDrawRange(0, 0);
    this.trailLine = new THREE.Line(this.trailGeometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);

    this.group.visible = false;
    app.earth.spin.add(this.group);
    return true;
  }

  show(lat, lon) {
    if (!this.attach()) return;
    const R = this.app.earth.radius * ISS_ALTITUDE;
    const local = latLonToVector3(lat, lon, 1);
    this.target = local;
    this.head.position.copy(local).multiplyScalar(R);

    this.trail.push(local.clone().multiplyScalar(R));
    if (this.trail.length > TRAIL_POINTS) this.trail.shift();
    const pos = this.trailGeometry.attributes.position;
    const col = this.trailGeometry.attributes.color;
    const n = this.trail.length;
    this.trail.forEach((p, i) => {
      pos.setXYZ(i, p.x, p.y, p.z);
      const k = (i + 1) / n; // fades out toward the oldest fix
      col.setXYZ(i, 0.22 * k, 0.74 * k, 0.97 * k);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.trailGeometry.setDrawRange(0, n);

    this.group.visible = true;
    this.steer = true;
    if (!this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  hide() {
    this.steer = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.group) this.group.visible = false;
    this.trail = [];
    this.trailGeometry?.setDrawRange(0, 0);
  }

  // Pulse the marker and, in the solar or orbit view only, ease the globe's
  // spin so the ISS turns to face the camera. Destination flights and the
  // atlas own the camera, so the globe is left alone there.
  tick(now) {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const app = this.app;
    if (this.glow) this.glow.material.opacity = 0.75 + 0.25 * Math.sin(now * 0.004);

    if (this.steer && this.target && app?.camera && (app.mode === 'solar' || app.mode === 'explore')) {
      const earth = app.earth;
      const toCamera = new THREE.Vector3().copy(app.camera.position).sub(earth.center);
      const tiltQuat = new THREE.Quaternion();
      earth.tilt.getWorldQuaternion(tiltQuat);
      toCamera.applyQuaternion(tiltQuat.invert());
      const wanted = Math.atan2(toCamera.x, toCamera.z) - Math.atan2(this.target.x, this.target.z);
      let diff = wanted - earth.spinAngle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const step = diff * Math.min(1, dt * 1.2);
      earth.spinAngle += step;
      earth.spin.rotation.y = earth.spinAngle;
    }
    this.raf = requestAnimationFrame(this.frame);
  }
}

// ---------------------------------------------------------------- controller

export class LiveIssMode {
  constructor({ button, readout, status, container }) {
    this.button = button;
    this.readout = readout;
    this.status = status;
    this.container = container;
    this.voice = new IssVoice();
    this.marker = new IssMarker();
    this.active = false;
    this.timer = 0;
    this.requestId = 0;
    this.lastText = '';
    this.button.addEventListener('click', () => this.toggle());
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.setPressed(true);
    this.announce('Live ISS mode on. Tracking the space station.');
    this.readout.textContent = 'Locating ISS…';
    try {
      await this.voice.open();
    } catch (error) {
      this.active = false;
      this.setPressed(false);
      this.readout.textContent = 'Audio unavailable';
      this.announce('Live ISS mode could not start audio.');
      return;
    }
    if (!this.active) return;
    this.firstFix = true;
    this.poll();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.requestId += 1;
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.setPressed(false);
    this.announce('Live ISS mode off.');
    this.container?.removeAttribute('data-live');
    this.voice.fadeOut();
    this.marker.hide();
    this.readout.textContent = this.lastText ? `${this.lastText} · paused` : 'LAT — · LON —';
  }

  async poll() {
    if (!this.active) return;
    const id = ++this.requestId;
    try {
      const position = await fetchIssPosition();
      if (id !== this.requestId || !this.active) return;
      this.apply(position);
    } catch (error) {
      if (id !== this.requestId || !this.active) return;
      this.readout.textContent = this.lastText ? `${this.lastText} · feed lost, retrying` : 'ISS feed unavailable, retrying';
      this.container?.removeAttribute('data-live');
    }
    if (this.active) this.timer = window.setTimeout(() => this.poll(), POLL_MS);
  }

  apply({ latitude, longitude, source }) {
    const note = snapToScale(latitudeToFrequency(latitude));
    const pan = longitudeToPan(longitude);
    const { region, km } = nearestRegion(latitude, longitude);

    this.voice.setPosition(note.frequency, pan);
    if (this.firstFix) {
      this.voice.fadeIn();
      this.firstFix = false;
    }
    this.voice.ping(note.frequency);

    const ambient = region ? REGION_ENVIRONMENT_AUDIO[region.id] : null;
    if (ambient) this.voice.setAmbient(ambient.file, AMBIENT_LEVEL * (ambient.volume || 0.7));

    this.marker.show(latitude, longitude);

    const kmText = Math.round(km).toLocaleString();
    this.lastText = `LAT ${formatCoord(latitude, 'N', 'S')} · LON ${formatCoord(longitude, 'E', 'W')}`;
    this.readout.textContent = `${this.lastText} · ${note.name} · near ${region?.name || '—'} (${kmText} km)`;
    this.readout.title = `Live from ${source}, updated ${new Date().toLocaleTimeString()}. Pan ${pan.toFixed(2)}.`
      + (ambient ? ` Ambient: ${ambient.name}.` : '');
    this.container?.setAttribute('data-live', '');
  }

  setPressed(on) {
    this.button.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.button.textContent = on ? 'Live ISS Mode ●' : 'Live ISS Mode';
  }

  announce(message) {
    if (this.status) this.status.textContent = message;
  }
}

const button = document.getElementById('iss-toggle');
if (button) {
  window.__hearthIss = new LiveIssMode({
    button,
    readout: document.getElementById('iss-readout'),
    status: document.getElementById('iss-status'),
    container: document.getElementById('iss-live')
  });
}
