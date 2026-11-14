import './style.css';
import * as Tone from 'tone';
import { $ } from './ui/dom.js';
import { createVoiceGuide } from './ui/voice.js';
import { createGlobeView } from './ui/globeView.js';
import { createLabView } from './ui/labView.js';
import { createSpaceView } from './ui/spaceView.js';

const voice = createVoiceGuide();
const volumeIn = $('#volume');
let muted = false;
const getVolume = () => (muted ? 0 : Number(volumeIn.value) / 100);

const globe = createGlobeView({ voice, getVolume });
const lab = createLabView({ voice, getVolume });
const space = createSpaceView({ voice, onEarth: () => showView('globe') });
const VIEWS = { space, globe, lab };
const SAY = { space: 'Solar system. Pick a planet.', globe: 'Earth. Pick a place.', lab: 'Frame Lab. Pick a visualization.' };
let view = 'space';

// ---------- views ----------
function showView(name) {
  if (name === view) return;
  VIEWS[view].stop();
  view = name;
  for (const v of Object.keys(VIEWS)) $(`#view-${v}`).hidden = v !== name;
  space.setRunning(name === 'space');
  for (const b of document.querySelectorAll('.view-tab')) {
    b.setAttribute('aria-pressed', String(b.dataset.view === name));
  }
  if (name === 'lab') lab.onShow();
  if (name === 'globe') globe.onShow();
  voice.say(SAY[name]);
  $('#main').focus({ preventScroll: true });
}
for (const b of document.querySelectorAll('.view-tab')) {
  b.addEventListener('click', () => showView(b.dataset.view));
}

// ---------- voice guide ----------
const voiceBtn = $('#voice-toggle');
function syncVoiceBtn() { voiceBtn.setAttribute('aria-pressed', String(voice.enabled)); }
if (!voice.supported) { voiceBtn.disabled = true; voiceBtn.title = 'This browser cannot speak.'; }
voiceBtn.addEventListener('click', () => {
  voice.set(!voice.enabled);
  syncVoiceBtn();
  if (voice.enabled) voice.say('Voice guide on.');
});
syncVoiceBtn();

// ---------- volume ----------
function applyVolume() {
  const v = getVolume();
  globe.setVolume(v);
  lab.setVolume(v);
  space.setVolume(v);
}
volumeIn.addEventListener('input', () => { muted = false; applyVolume(); });
function nudgeVolume(d) {
  volumeIn.value = String(Math.min(100, Math.max(0, Number(volumeIn.value) + d)));
  muted = false;
  applyVolume();
  voice.say(`Volume ${volumeIn.value} percent.`);
}

// ---------- help ----------
const help = $('#help');
$('#help-open').addEventListener('click', () => help.showModal());

// ---------- entry gate ----------
// The click also unlocks browser audio, which needs a user gesture.
const gate = $('#gate');
let gateOpen = true;
async function enter(withVoice) {
  if (!gateOpen) return;
  gateOpen = false;
  try { await Tone.start(); } catch { /* audio unlock retried on first play */ }
  if (withVoice) { voice.set(true); syncVoiceBtn(); }
  gate.classList.add('leaving');
  setTimeout(() => { gate.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  $('#main').focus({ preventScroll: true });
  space.intro();
  voice.say('Earth Information Jukebox. You are approaching the solar system. Pick a planet, or fly down to Earth. Press question mark for keys.');
}
$('#gate-go').addEventListener('click', () => enter(false));
$('#gate-voice').addEventListener('click', () => enter(true));
$('#gate-go').focus();

// ---------- keyboard ----------
const typing = (t) => t.closest('input:not([type=range]):not([type=checkbox]), select, textarea, [contenteditable]');

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (help.open) return;
  if (gateOpen) { if (e.key === 'Escape') enter(false); return; }
  if (typing(e.target)) return;
  const onRange = e.target.matches?.('input[type=range]');
  const k = e.key;

  if (k === '?') { help.showModal(); e.preventDefault(); return; }
  if (k === 's' || k === 'S') { showView('space'); return; }
  if (k === 'g' || k === 'G') { showView('globe'); return; }
  if (k === 'l' || k === 'L') { showView('lab'); return; }
  if (k === 'v' || k === 'V') { voiceBtn.click(); return; }
  if (k === 'm' || k === 'M') { muted = !muted; applyVolume(); voice.say(muted ? 'Muted.' : 'Sound on.'); return; }
  if (k === '+' || k === '=') { nudgeVolume(10); return; }
  if (k === '-' || k === '_') { nudgeVolume(-10); return; }
  if (k === 'Escape') { VIEWS[view].skipIntro?.(); return; }

  if (k === ' ' && !e.target.closest('button, summary')) {
    e.preventDefault();
    VIEWS[view].togglePlay();
    return;
  }

  if (view === 'space') {
    if (k === '/') { e.preventDefault(); space.focusList(); }
    return;
  }

  if (view === 'globe') {
    if (k === '/') { e.preventDefault(); globe.focusRegions(); return; }
    if ((k === 'c' || k === 'C')) { globe.openCompare(); return; }
    if (!onRange && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      globe.stepYear(k === 'ArrowLeft' ? -1 : 1);
    }
    return;
  }

  // lab
  if (/^[1-4]$/.test(k)) { lab.pickTrack(k); return; }
  if (k === 'e' || k === 'E') { lab.setExplore(); return; }
  const step = e.shiftKey ? 0.1 : 0.03;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[k] && !onRange && lab.moveCursor(...moves[k])) e.preventDefault();
});

space.init();
globe.init();
lab.init();
