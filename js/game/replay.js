// The map page as a replay of his run: island by island, the avatar stands on
// each pick while the dock tells that part in his own words. Read-only.
import { STEPS } from '../content.js';
import { h, icon, sheet, fmtDateTime } from '../ui.js';
import { storyBeats } from '../mind/story.js';
import { storyTimeline } from '../storyView.js';
import { gameWorld } from './index.js';
import { nav } from '../nav.js';

// Which island each story beat belongs to.
const ISLAND_FOR = {
  worry: 'worry', body: 'body', zone: 'sort', dig: 'core', core: 'core', reality: 'reality',
  tools: 'cope', act: 'act', next: 'next', check: 'done', detours: null, stopped: null, unfinished: null,
};

// Stops in course order, each with the beats told there.
function stopsFor(m) {
  const beats = storyBeats(m);
  const stops = [];
  for (const b of beats) {
    const step = ISLAND_FOR[b.id] ?? (stops.length ? stops[stops.length - 1].step : 'worry');
    let stop = stops.find((s) => s.step === step);
    if (!stop) {
      stop = { step, beats: [] };
      stops.push(stop);
    }
    stop.beats.push(b);
  }
  const order = (s) => (s === 'done' ? STEPS.length : STEPS.indexOf(s));
  return stops.sort((a, b) => order(a.step) - order(b.step));
}

export function replayScreen(m, { extra = null } = {}) {
  const stops = stopsFor(m);
  let i = 0;
  let timer = null;
  let playing = false;

  const top = h('header', { class: 'map-header' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'My maps', title: 'My maps', onClick: () => nav.go('maps') }, icon('back')),
  );
  const slot = h('div', { class: 'world-slot', 'aria-hidden': 'true' });
  const counter = h('span', { class: 'replay-count' });
  const card = h('div', { class: 'replay-card', 'aria-live': 'polite' });
  const prev = h('button', { type: 'button', class: 'btn btn-secondary btn-small', 'aria-label': 'Previous part', onClick: () => go(i - 1) }, icon('back', 18));
  const next = h('button', { type: 'button', class: 'btn btn-secondary btn-small', 'aria-label': 'Next part', onClick: () => go(i + 1) }, icon('next', 18));
  const play = h('button', { type: 'button', class: 'btn btn-primary', onClick: () => (playing ? stop() : start()) });
  const els = {};
  const dock = h('section', { class: 'dock', 'aria-label': 'Replay' },
    h('main', { class: 'map-body' },
      h('p', { class: 'eyebrow' }, fmtDateTime(m.createdAt)),
      h('h1', { tabindex: '-1', class: 'detail-title' }, `What if ${m.worry.text || '…'}?`),
      card,
      extra,
    ),
    h('footer', { class: 'map-footer replay-controls' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Read it as a story', title: 'Read it as a story', onClick: () => readIt(m) }, icon('book')),
      h('div', { class: 'footer-right' }, prev, counter, next, play),
    ),
  );
  Object.assign(els, { top, slot, dock });

  function paint() {
    const s = stops[i];
    counter.textContent = `${i + 1}/${stops.length}`;
    prev.disabled = i === 0;
    next.disabled = i === stops.length - 1;
    play.replaceChildren(icon(playing ? 'close' : 'next', 18), playing ? 'Stop' : i === stops.length - 1 ? 'Replay' : 'Play');
    card.replaceChildren(...s.beats.map((b) => h('div', { class: 'replay-beat' }, h('p', { class: 'replay-title' }, b.title), h('p', { class: 'replay-text' }, b.text))));
  }
  function go(k) {
    i = Math.max(0, Math.min(stops.length - 1, k));
    paint();
    gameWorld.show(stops[i].step, m, els);
  }
  function start() {
    if (i === stops.length - 1) i = -1;
    playing = true;
    tick();
  }
  function tick() {
    if (!dock.isConnected) return stop();
    if (i >= stops.length - 1) return stop();
    go(i + 1);
    const words = stops[i].beats.reduce((n, b) => n + b.text.length, 0);
    timer = setTimeout(tick, Math.max(3200, words * 50));
  }
  function stop() {
    clearTimeout(timer);
    playing = false;
    paint();
  }

  paint();
  gameWorld.show(stops[0].step, m, els);
  return h('div', { class: 'screen map-screen game replay-screen' }, top, slot, dock);
}

function readIt(m) {
  return sheet((close) => [
    h('h2', { class: 'sheet-title' }, `What if ${m.worry.text || '…'}?`),
    h('p', { class: 'hint' }, fmtDateTime(m.createdAt)),
    storyTimeline(m),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onClick: () => close() }, 'Close')),
  ], { label: 'The story of this map' });
}
