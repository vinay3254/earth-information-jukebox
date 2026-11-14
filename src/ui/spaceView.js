// Solar system view: planet picker, fact card, orbit chimes, dive to Earth.
import { $, el } from './dom.js';
import { createSolarSystem } from '../space/solarSystem.js';
import { createChimes } from '../space/chimes.js';

const fmtNum = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });

function yearText(days) {
  if (days < 1000) return `${fmtNum(days)} Earth days`;
  return `${fmtNum(days / 365.25)} Earth years`;
}
function dayText(hours) {
  return hours > 72 ? `${fmtNum(hours / 24)} Earth days` : `${fmtNum(hours)} hours`;
}

export function createSpaceView({ voice, onEarth }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chimes = createChimes();
  let system = null;
  let selected = null;

  const listEl = $('#planet-list');
  const card = $('#planet-card');
  const chimeBtn = $('#chimes');

  function showCard(p) {
    $('#planet-name').textContent = p.name;
    $('#planet-fact').textContent = p.fact;
    $('#pf-au').textContent = `${p.au} AU (${fmtNum(p.au * 149.6)} million km)`;
    $('#pf-year').textContent = yearText(p.periodDays);
    $('#pf-day').textContent = dayText(p.dayHours);
    $('#pf-temp').textContent = `${p.tempC} °C`;
    $('#pf-moons').textContent = String(p.moons);
    card.hidden = false;
  }

  async function select(id) {
    const p = system?.planets.find((x) => x.id === id);
    if (!p) return;
    selected = p;
    for (const b of listEl.querySelectorAll('.choice')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    showCard(p);
    chimes.ring(p, true);
    voice.say(`${p.name}. ${p.fact} One year is ${yearText(p.periodDays)}.`);
    await system.focus(id);
  }

  async function goEarth() {
    if (!system) { onEarth(); return; }
    voice.say('Flying down to Earth.');
    await system.focus('earth', 3.2);
    await system.diveInto('earth');
    const fade = $('#fade');
    fade.classList.add('on');
    await new Promise((r) => setTimeout(r, reduced ? 0 : 600));
    onEarth();
    await new Promise((r) => setTimeout(r, reduced ? 0 : 150));
    fade.classList.remove('on');
  }

  $('#go-earth').addEventListener('click', goEarth);
  $('#space-overview').addEventListener('click', () => {
    selected = null;
    card.hidden = true;
    for (const b of listEl.querySelectorAll('.choice')) b.setAttribute('aria-pressed', 'false');
    system?.overview();
  });
  chimeBtn.addEventListener('click', () => {
    chimes.set(!chimes.enabled);
    chimeBtn.setAttribute('aria-pressed', String(chimes.enabled));
    voice.say(chimes.enabled ? 'Orbit chimes on.' : 'Orbit chimes off.');
  });
  $('#space-speed').addEventListener('change', (e) => system?.setSpeed(Number(e.target.value)));

  function init() {
    try {
      system = createSolarSystem($('#space-mount'), {
        onSelect: (id) => select(id),
        onChime: (p) => chimes.ring(p),
        reducedMotion: reduced
      });
    } catch (err) {
      console.warn('Solar system failed', err);
      const s = $('#space-status');
      s.textContent = '3D graphics are not available in this browser. Use the planet list.';
      s.hidden = false;
    }
    const planets = system?.planets || [];
    listEl.replaceChildren(
      ...planets.map((p) => el('button', { type: 'button', class: 'choice', 'aria-pressed': 'false', 'data-id': p.id, onclick: () => select(p.id) }, [p.name]))
    );
  }

  return {
    init,
    intro: () => system?.intro(),
    skipIntro: () => system?.skipIntro(),
    setRunning: (on) => system?.setRunning(on),
    setVolume: (v) => chimes.setVolume(v),
    togglePlay: () => chimeBtn.click(),
    stop: () => {},
    focusList: () => (listEl.querySelector('[aria-pressed="true"]') || listEl.querySelector('button'))?.focus(),
    goEarth
  };
}
