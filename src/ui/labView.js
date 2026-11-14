// Frame Lab: NASA videos sonified live from their frames.
import { $, el, announce } from './dom.js';
import { TRACKS } from '../tracks.js';

export function createLabView({ voice, getVolume }) {
  const state = { engine: null, track: null, playing: false, explore: false, cursor: { x: 0.5, y: 0.5 }, last: null };

  const video = $('#lab-video');
  const overlay = $('#lab-overlay');
  const listEl = $('#track-list');
  const playBtn = $('#lab-play');
  const exploreBtn = $('#lab-explore');
  const hint = $('#explore-hint');
  const caption = $('#lab-caption');
  const status = $('#lab-status');

  function setStatus(text) { status.textContent = text || ''; status.hidden = !text; }

  // ---------- overlay ----------
  function fitOverlay() {
    const r = video.getBoundingClientRect();
    const p = video.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    Object.assign(overlay.style, {
      left: `${r.left - p.left}px`, top: `${r.top - p.top}px`,
      width: `${r.width}px`, height: `${r.height}px`
    });
    overlay.width = Math.round(r.width * dpr);
    overlay.height = Math.round(r.height * dpr);
  }

  function draw() {
    const ctx = overlay.getContext('2d');
    const w = overlay.width;
    const h = overlay.height;
    ctx.clearRect(0, 0, w, h);
    const amber = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#f2b544';
    const f = state.last;
    if (!state.explore && f && state.track?.id === 'nightlights' && typeof f.scanX === 'number') {
      const x = f.scanX * w;
      ctx.fillStyle = amber;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x - 1.5, 0, 3, h);
      ctx.globalAlpha = 1;
    }
    if (!state.explore && f?.hotspots?.length) {
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2;
      for (const s of f.hotspots.slice(0, 40)) {
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, 4 + 8 * (s.strength || 0), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (state.explore) {
      const x = state.cursor.x * w;
      const y = state.cursor.y * h;
      ctx.strokeStyle = amber;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.moveTo(x - 28, y); ctx.lineTo(x - 10, y);
      ctx.moveTo(x + 10, y); ctx.lineTo(x + 28, y);
      ctx.moveTo(x, y - 28); ctx.lineTo(x, y - 10);
      ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 28);
      ctx.stroke();
    }
  }

  // ---------- live readout ----------
  const meters = [
    ['brightness', 'Brightness', (f) => Math.min(1, (f.meanLuma || 0) * 5)],
    ['motion', 'Change', (f) => Math.min(1, (f.motion || 0) * 25)],
    ['warm', 'Warm colour', (f) => f.hue?.warm],
    ['cool', 'Cool colour', (f) => f.hue?.cool],
    ['spots', 'New bright spots', (f) => Math.min(1, (f.hotspots?.length || 0) / 10)]
  ];
  const readout = $('#readout');
  const meterEls = meters.map(([id, label]) => {
    const fill = el('span', { class: 'fill' });
    const num = el('span', { class: 'num' }, ['–']);
    readout.append(el('div', { class: 'meter' }, [el('dt', {}, [label]), el('dd', { class: 'track' }, [fill]), num]));
    return { fill, num };
  });
  let lastReadout = 0;
  function updateReadout(f) {
    const now = performance.now();
    if (now - lastReadout < 120) return;
    lastReadout = now;
    meters.forEach(([, , get], i) => {
      const v = Math.max(0, Math.min(1, Number(get(f)) || 0));
      meterEls[i].fill.style.width = `${(v * 100).toFixed(0)}%`;
      meterEls[i].num.textContent = `${Math.round(v * 100)}`;
    });
  }

  // ---------- tracks ----------
  function renderTracks() {
    listEl.replaceChildren(
      ...TRACKS.map((t) =>
        el('button', {
          type: 'button', class: 'choice', 'aria-pressed': 'false', 'data-id': t.id,
          onclick: () => selectTrack(t.id)
        }, [t.title, el('small', {}, [`Key ${t.key}`])])
      )
    );
  }

  async function selectTrack(id) {
    const t = TRACKS.find((x) => x.id === id);
    if (!t) return;
    const wasPlaying = state.playing;
    if (state.playing) pause();
    state.track = t;
    state.last = null;
    for (const b of listEl.querySelectorAll('.choice')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    $('#track-summary').textContent = t.summary;
    $('#track-mapping').textContent = t.mappingText;
    const src = $('#track-source');
    src.replaceChildren('Source: ', el('a', { href: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api' }, [t.source]));
    video.poster = t.poster;
    video.src = t.video;
    video.setAttribute('aria-label', `${t.title}. ${t.summary}`);
    video.style.visibility = 'hidden';
    video.onerror = () => setStatus(`The ${t.title} video is missing. Run scripts/fetch_media.py to download it.`);
    video.onloadeddata = () => { video.style.visibility = ''; setStatus(''); fitOverlay(); };
    await state.engine?.load(t.id, video);
    voice.say(`${t.title}. ${t.summary}`);
    if (wasPlaying) play();
    draw();
  }

  // ---------- playback ----------
  async function play() {
    if (!state.engine || !state.track) return;
    if (state.explore) setExplore(false);
    await state.engine.play();
    state.playing = true;
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.textContent = 'Pause';
  }
  function pause() {
    state.engine?.pause();
    state.playing = false;
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = 'Play';
  }
  function togglePlay() { state.playing ? pause() : play(); }

  function setExplore(on) {
    state.explore = on;
    state.engine?.setExplore(on);
    if (on) { state.playing = false; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = 'Play'; }
    exploreBtn.setAttribute('aria-pressed', String(on));
    hint.hidden = !on;
    voice.say(on ? 'Explore by hand. Arrow keys move the listening point.' : 'Explore off.');
    if (on) probe();
    draw();
  }

  function probe() { state.engine?.probe(state.cursor.x, state.cursor.y); draw(); }

  function moveCursor(dx, dy) {
    if (!state.explore) return false;
    state.cursor.x = Math.min(1, Math.max(0, state.cursor.x + dx));
    state.cursor.y = Math.min(1, Math.max(0, state.cursor.y + dy));
    probe();
    return true;
  }

  // ---------- wiring ----------
  playBtn.addEventListener('click', togglePlay);
  exploreBtn.addEventListener('click', () => setExplore(!state.explore));
  overlay.parentElement.addEventListener('pointerdown', (e) => {
    if (!state.explore) return;
    const r = video.getBoundingClientRect();
    state.cursor.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    state.cursor.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    probe();
  });
  addEventListener('resize', () => { fitOverlay(); draw(); });

  async function init() {
    renderTracks();
    try {
      const mod = await import('../engine/index.js');
      state.engine = mod.createEngine();
      mod.audio?.setVolume?.(getVolume());
      state.engine.on('frame', (f) => { state.last = f; draw(); updateReadout(f); });
      state.engine.on('caption', (text) => { announce(caption, text); voice.say(text); });
      state.audio = mod.audio;
    } catch (err) {
      console.warn('Frame engine not available', err);
      setStatus('The sound engine failed to load.');
    }
    await selectTrack(TRACKS[0].id);
  }

  return {
    init,
    togglePlay,
    stop: pause,
    setExplore: () => setExplore(!state.explore),
    pickTrack: (key) => { const t = TRACKS.find((x) => x.key === key); if (t) selectTrack(t.id); },
    moveCursor,
    onShow: () => { fitOverlay(); draw(); },
    setVolume: (v) => state.audio?.setVolume?.(v)
  };
}
