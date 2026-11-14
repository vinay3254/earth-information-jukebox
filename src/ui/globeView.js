// Globe view: place picker, heat-ribbon year scrubber, data synth controls, compare.
import { $, el, announce } from './dom.js';

// Optional modules: built in parallel, may not exist yet. glob returns {} if missing.
const lazy = import.meta.glob(['../globe/index.js', '../datasynth/index.js']);
const load = (p) => (lazy[p] ? lazy[p]() : Promise.reject(new Error(`${p} missing`)));

const COOL = [58, 110, 165];
const MID_DARK = [120, 138, 156];
const MID_LIGHT = [205, 212, 219];
const WARM = [200, 85, 61];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Plain-language change between two years, from the data itself.
export function describeChange(region, ya, yb) {
  const A = region.years.find((y) => y.year === ya);
  const B = region.years.find((y) => y.year === yb);
  if (!A || !B) return '';
  const parts = [];
  const diff = (k, unit, digits, label) => {
    if (A[k] == null || B[k] == null) return;
    const d = B[k] - A[k];
    const word = Math.abs(d) < 10 ** -digits ? 'unchanged' : d > 0 ? 'up' : 'down';
    parts.push(word === 'unchanged'
      ? `${label} unchanged`
      : `${label} ${word} ${Math.abs(d).toFixed(digits)} ${unit} (${A[k].toFixed(digits)} to ${B[k].toFixed(digits)})`);
  };
  diff('tempC', '°C', 1, 'average temperature');
  diff('precipMm', 'mm', 0, 'yearly rain');
  diff('co2ppm', 'ppm', 0, 'carbon dioxide');
  diff('globalAnomalyC', '°C', 2, 'global temperature anomaly');
  return parts.length ? `${region.name}, ${ya} to ${yb}: ${parts.join('; ')}.` : '';
}

export function createGlobeView({ voice, getVolume }) {
  const state = { regions: [], region: null, year: null, synth: null, globe: null, playing: false };

  const listEl = $('#region-list');
  const listen = $('#listen');
  const yearIn = $('#year');
  const yearOut = $('#year-out');
  const nameEl = $('#region-name');
  const ribbon = $('#ribbon');
  const caption = $('#globe-caption');
  const playBtn = $('#synth-play');
  const sweepBtn = $('#synth-sweep');
  const voiceList = $('#voice-list');
  const cmpA = $('#cmp-a');
  const cmpB = $('#cmp-b');
  const cmpPresets = $('#cmp-presets');
  const cmpResult = $('#cmp-result');
  const plate = $('#plate');
  const plateImg = $('#plate-img');
  const plateCap = $('#plate-cap');
  const status = $('#globe-status');

  function setStatus(text) {
    status.textContent = text || '';
    status.hidden = !text;
  }

  function setCaption(text) { announce(caption, text); }

  function yearsOf(r) { return r ? r.years.map((y) => y.year) : []; }

  // ---------- ribbon ----------
  function drawRibbon() {
    const r = state.region;
    if (!r) return;
    const dpr = window.devicePixelRatio || 1;
    const w = ribbon.clientWidth;
    const h = ribbon.clientHeight;
    ribbon.width = Math.round(w * dpr);
    ribbon.height = Math.round(h * dpr);
    const ctx = ribbon.getContext('2d');
    ctx.scale(dpr, dpr);
    const light = matchMedia('(prefers-color-scheme: light)').matches;
    const mid = light ? MID_LIGHT : MID_DARK;
    const temps = r.years.map((y) => y.tempC).filter((v) => v != null);
    const mean = temps.reduce((a, b) => a + b, 0) / (temps.length || 1);
    const spread = Math.max(0.3, ...temps.map((t) => Math.abs(t - mean)));
    const n = r.years.length;
    const bw = w / n;
    r.years.forEach((y, i) => {
      if (y.tempC == null) {
        ctx.fillStyle = light ? '#e3e8ec' : '#1d3550';
      } else {
        const t = Math.max(-1, Math.min(1, (y.tempC - mean) / spread));
        const c = t < 0 ? mix(mid, COOL, -t) : mix(mid, WARM, t);
        ctx.fillStyle = `rgb(${c.join(',')})`;
      }
      ctx.fillRect(Math.floor(i * bw), 0, Math.ceil(bw) + 1, h);
    });
  }

  // ---------- region list ----------
  function renderRegions() {
    listEl.replaceChildren(
      ...state.regions.map((r, i) =>
        el('button', {
          type: 'button',
          class: 'choice',
          'aria-pressed': 'false',
          'data-id': r.id,
          onclick: () => selectRegion(r.id)
        }, [r.name, el('small', {}, [r.story || ''])])
      )
    );
  }

  // ---------- voices ----------
  function renderVoices() {
    const synth = state.synth;
    const voices = synth?.voices || [];
    if (!voices.length) {
      voiceList.replaceChildren(el('li', { class: 'voice' }, ['Sound engine is loading.']));
      return;
    }
    voiceList.replaceChildren(
      ...voices.map((v) => {
        const id = `voice-${v.name}`;
        const has = v.value != null;
        return el('li', { class: 'voice' }, [
          el('input', {
            type: 'checkbox', id, checked: v.enabled,
            onchange: (e) => synth.setVoice(v.name, e.target.checked)
          }),
          el('label', { for: id }, [v.label, v.sound ? el('small', {}, [v.sound]) : '']),
          el('span', { class: has ? 'val' : 'val none' }, [has ? formatVal(v.value, v.unit) : 'no data'])
        ]);
      })
    );
  }

  function formatVal(value, unit) {
    const n = Number(value);
    const digits = Math.abs(n) >= 100 ? 0 : 1;
    return `${n.toFixed(digits)} ${unit || ''}`.trim();
  }

  // ---------- plate (satellite image for the year) ----------
  function updatePlate() {
    const y = state.region?.years.find((d) => d.year === state.year);
    if (y?.imagery) {
      plateImg.src = y.imagery;
      plateImg.alt = `Satellite photo of ${state.region.name}, ${state.year}, from NASA MODIS.`;
      plateCap.textContent = `${state.region.name}, ${state.year}. NASA MODIS true color.`;
      plate.hidden = false;
    } else {
      plate.hidden = true;
    }
  }

  // ---------- year ----------
  function setYear(year, { speak = true } = {}) {
    state.year = year;
    yearIn.value = String(year);
    yearOut.textContent = String(year);
    yearIn.setAttribute('aria-valuetext', `${year}`);
    state.synth?.setYear?.(year);
    updatePlate();
    renderVoices();
    const text = state.synth?.describe?.(year) || `${state.region.name}, ${year}.`;
    setCaption(text);
    if (speak) voice.sayLater(text);
  }

  // ---------- compare ----------
  function fillCompare() {
    const ys = yearsOf(state.region);
    const opts = () => ys.map((y) => el('option', { value: y }, [String(y)]));
    cmpA.replaceChildren(...opts());
    cmpB.replaceChildren(...opts());
    cmpA.value = ys[0];
    cmpB.value = ys[ys.length - 1];
    const first = ys[0];
    const last = ys[ys.length - 1];
    const presets = [[first, last]];
    for (let y = Math.ceil(first / 10) * 10; y + 10 <= last; y += 10) presets.push([y, y + 10]);
    cmpPresets.replaceChildren(
      ...presets.map(([a, b]) =>
        el('button', {
          type: 'button', class: 'secondary',
          onclick: () => { cmpA.value = a; cmpB.value = b; runCompare(); }
        }, [`${a} and ${b}`])
      )
    );
    cmpResult.textContent = '';
  }

  async function runCompare() {
    const a = Number(cmpA.value);
    const b = Number(cmpB.value);
    const text = describeChange(state.region, a, b);
    cmpResult.textContent = text;
    setCaption(text);
    voice.say(text);
    stopPlayback();
    try {
      await state.synth?.compare?.(a, b, { secondsEach: 4 });
    } catch (err) {
      console.warn('compare failed', err);
    }
  }

  // ---------- playback ----------
  function setPlaying(on) {
    state.playing = on;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.textContent = on ? 'Pause' : 'Play this year';
  }

  function stopPlayback() {
    state.synth?.pause?.();
    setPlaying(false);
  }

  async function togglePlay() {
    if (!state.region || !state.synth) return;
    if (state.playing) { stopPlayback(); return; }
    await state.synth.play();
    setPlaying(true);
  }

  async function sweep() {
    if (!state.region || !state.synth) return;
    const ys = yearsOf(state.region);
    stopPlayback();
    setPlaying(true);
    voice.say(`Playing ${state.region.name} from ${ys[0]} to ${ys[ys.length - 1]}.`);
    await state.synth.playSweep?.({ from: ys[0], to: ys[ys.length - 1], secondsPerYear: 0.6 });
  }

  // ---------- region ----------
  async function selectRegion(id) {
    const r = state.regions.find((x) => x.id === id);
    if (!r) return;
    stopPlayback();
    state.region = r;
    for (const b of listEl.querySelectorAll('.choice')) {
      b.setAttribute('aria-pressed', String(b.dataset.id === id));
    }
    const ys = yearsOf(r);
    yearIn.min = ys[0];
    yearIn.max = ys[ys.length - 1];
    nameEl.textContent = r.name;
    listen.hidden = false;
    state.synth?.setRegion?.(r);
    drawRibbon();
    fillCompare();
    setYear(ys[ys.length - 1], { speak: false });
    const arrive = `${r.name}. ${r.story || ''} Years ${ys[0]} to ${ys[ys.length - 1]}. Use left and right arrows to change year.`;
    voice.say(arrive);
    state.globe?.setHighlight?.(id);
    try { await state.globe?.flyTo?.(id); } catch { /* globe optional */ }
  }

  // ---------- wiring ----------
  yearIn.addEventListener('input', () => setYear(Number(yearIn.value)));
  playBtn.addEventListener('click', togglePlay);
  sweepBtn.addEventListener('click', sweep);
  $('#cmp-go').addEventListener('click', runCompare);
  addEventListener('resize', drawRibbon);

  async function loadSynth() {
    try {
      const mod = await load('../datasynth/index.js');
      const synth = mod.createDataSynth();
      synth.on?.('year', (y) => setYear(y, { speak: false }));
      synth.on?.('caption', (t) => setCaption(t));
      synth.on?.('compare', (info) => {
        if (info?.year) setYear(info.year, { speak: false });
      });
      synth.on?.('end', () => setPlaying(false));
      synth.setVolume?.(getVolume());
      state.synth = synth;
      if (state.region) { synth.setRegion(state.region); synth.setYear(state.year); renderVoices(); }
    } catch (err) {
      console.warn('Data synth not available yet', err);
      setStatus('The sound engine is not ready yet. Place data and the globe still work.');
    }
  }

  async function loadGlobe() {
    try {
      const mod = await load('../globe/index.js');
      state.globe = mod.createGlobe($('#globe-mount'), {
        regions: state.regions.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })),
        onSelect: (id) => selectRegion(id)
      });
    } catch (err) {
      console.warn('Globe not available yet', err);
      setStatus('The 3D globe is not ready yet. Pick a place from the list.');
    }
  }

  async function init() {
    try {
      const res = await fetch('data/regions.json');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.regions = data.regions || [];
    } catch { /* handled below */ }
    renderRegions();
    if (!state.regions.length) {
      listEl.replaceChildren(el('p', {}, ['Place data is missing. Run scripts/fetch_data.py to download it.']));
    }
    renderVoices();
    await Promise.all([loadGlobe(), loadSynth()]);
  }

  return {
    init,
    togglePlay,
    stop: stopPlayback,
    stepYear(d) {
      if (!state.region) return;
      const ys = yearsOf(state.region);
      const i = Math.max(0, Math.min(ys.length - 1, ys.indexOf(state.year) + d));
      setYear(ys[i]);
    },
    openCompare() {
      if (!state.region) return;
      const det = $('#compare');
      det.open = true;
      cmpA.focus();
    },
    focusRegions() { (listEl.querySelector('[aria-pressed="true"]') || listEl.querySelector('button'))?.focus(); },
    skipIntro() { state.globe?.skipIntro?.(); },
    setVolume(v) { state.synth?.setVolume?.(v); }
  };
}
