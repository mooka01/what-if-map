// The game world facade. Screens call show() (a map step on the course) or
// scene() (a hub screen: home, maps, score...) while they render; the router
// turns the world off for screens that call neither. three.js, the course and
// the hub load lazily the first time a game screen appears.
import { mindEnabled, markMindFailed } from '../mind/index.js';
import { state } from '../store.js';
import { setSound } from './audio.js';

let game = null;
let course = null;
let hub = null;
let loading = null;
let shown = false;
let pending = null;

function load() {
  loading ||= Promise.all([import('./engine.js'), import('./course.js'), import('./hub.js')])
    .then(([e, c, hb]) => {
      game = e.createGame();
      course = c.createCourse(game);
      hub = hb.createHub(game);
    })
    .catch((err) => {
      markMindFailed(err);
      throw err;
    });
  return loading;
}

function start(next) {
  shown = true;
  document.body.classList.add('game-on');
  document.body.classList.toggle('course-on', next.kind === 'course');
  setSound(!!state.settings.sound);
  pending = next;
  load()
    .then(() => {
      const p = pending;
      pending = null;
      if (!p) return;
      game.avatar.setStyle(state.settings.avatar || {});
      if (p.kind === 'course') {
        game.setStage(course);
        requestAnimationFrame(() => course.enter(p.step, p.map, p.els));
      } else {
        game.setStage(hub);
        requestAnimationFrame(() => hub.enter(p.name, p.data, p.els));
      }
    })
    .catch(() => {});
}

export const gameWorld = {
  enabled: () => mindEnabled(),

  // The router brackets every render with these.
  beginRender() {
    shown = false;
  },
  endRender() {
    if (shown) return;
    pending = null;
    document.body.classList.remove('game-on', 'course-on');
    if (game) game.setStage(null);
    course?.reset();
  },

  // A map step (or 'done') on the course. els: { top, slot, dock }.
  show(step, map, els) {
    start({ kind: 'course', step, map, els });
  },

  // A hub scene (home, maps, score, patterns, check...). data is screen-specific.
  scene(name, data, els) {
    start({ kind: 'hub', name, data, els });
  },

  sync(map) {
    course?.sync(map);
  },

  // Hub scenes can be told about changes without a full re-render.
  update(data) {
    hub?.apply?.(data);
  },

  // For tests: is the world up, and where are its tap targets?
  debug: () => ({ ready: !!game && document.body.classList.contains('game-on'), targets: game ? game.tapTargets() : [] }),
};
