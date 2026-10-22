// Boot, routing, lock, offline.
import { initStore, state, activeMap, flushSave } from './store.js';
import { mapScreen, doneScreen, safetyScreen } from './flow.js';
import { nowScreen } from './now.js';
import { ladderScreen, ladderTryScreen } from './ladder.js';
import {
  homeScreen, onboardingScreen, capScreen, mapsScreen, mapDetailScreen, checkScreen, scoreScreen,
  patternsScreen, shareScreen, settingsScreen, guideScreen, takeHub,
} from './screens.js';
import { hasPin, showLock } from './lock.js';
import { refreshServer, flushOutbox, therapistName } from './home.js';
import { applyTheme } from './theme.js';
import { h, icon, toast } from './ui.js';
import { nav } from './nav.js';
import { mind } from './mind/index.js';
import { gameWorld } from './game/index.js';
import { wrapHub } from './game/layout.js';
import { hubData } from './game/hubData.js';

// [pattern, screen, active tab or null for full-screen views]
const ROUTES = [
  [/^$/, () => homeScreen(), 'home'],
  [/^map$/, () => mapScreen(), null],
  [/^done\/(.+)$/, (id) => doneScreen(id), null],
  [/^safety$/, () => safetyScreen(), null],
  [/^help$/, () => ((nav.safety = null), safetyScreen()), null],
  [/^cap$/, () => capScreen(), null],
  [/^now$/, () => nowScreen(), null],
  [/^ladder$/, () => ladderScreen(), 'home'],
  [/^ladder\/try$/, () => ladderTryScreen(), null],
  [/^maps$/, () => mapsScreen(), 'maps'],
  [/^maps\/(.+)$/, (id) => mapDetailScreen(id), 'maps'],
  [/^check\/(.+)$/, (id) => checkScreen(id), null],
  [/^score$/, () => scoreScreen(), 'score'],
  [/^patterns$/, () => patternsScreen(), 'patterns'],
  [/^share$/, () => shareScreen(), 'maps'],
  [/^settings$/, () => settingsScreen(), 'home'],
  [/^guide$/, () => guideScreen(), 'home'],
];

const TABS = [
  ['', 'home', 'Home'],
  ['maps', 'maps', 'Maps'],
  ['score', 'score', 'Score'],
  ['patterns', 'patterns', 'Patterns'],
];

let root;
let lastRoute = null;

function currentRoute() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ''));
}

function render() {
  const route = currentRoute();
  let found = ROUTES.find(([re]) => re.test(route));
  if (!found) found = ROUTES[0];
  if (!state.settings.onboarded && route !== 'guide') found = [null, () => onboardingScreen(), null];
  const [re, screen, tab] = found;
  const params = re ? route.match(re).slice(1) : [];

  gameWorld.beginRender();
  let el = screen(...params);
  // Hub screens move into the game world (unless Calm mode or no 3D).
  const hub = takeHub();
  if (hub && gameWorld.enabled()) el = wrapHub(el, hub, { gameWorld, hubData });
  gameWorld.endRender();
  root.replaceChildren(el, tab ? tabBar(tab) : '');
  root.dataset.tabbar = tab ? 'yes' : 'no';
  if (route !== lastRoute || route === 'map') {
    window.scrollTo(0, 0);
    el.querySelector('h1')?.focus({ preventScroll: true });
  }
  lastRoute = route;
}

// Ask the home computer (if any) for its email setup, then send anything waiting.
let syncing = false;
async function syncHome() {
  if (syncing) return;
  syncing = true;
  try {
    const before = JSON.stringify(state.settings.server);
    const result = await refreshServer();
    const sent = result === 'online' ? await flushOutbox() : 0;
    if (sent) toast(`Sent the waiting summary to ${therapistName()}.`);
    if (currentRoute() === '' && (sent || before !== JSON.stringify(state.settings.server))) render();
  } finally {
    syncing = false;
  }
}

function tabBar(active) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Main' },
    TABS.map(([route, key, label]) =>
      h('a', { href: `#/${route}`, class: 'tab', 'aria-current': active === key ? 'page' : null }, icon(key), h('span', null, label)),
    ),
  );
}

export async function boot({ root: el, dbName, registerSW = true } = {}) {
  root = el;
  await initStore(dbName);
  applyTheme(state.settings.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(state.settings.theme));
  nav.render = render;
  window.addEventListener('hashchange', render);

  if (hasPin()) showLock();
  render();
  syncHome();

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      flushSave(activeMap());
      return;
    }
    if (hasPin() && Date.now() - hiddenAt > 60 * 1000) showLock();
    // Tomorrow-check cards depend on the clock; refresh home when coming back.
    if (currentRoute() === '') render();
    syncHome();
  });
  window.addEventListener('online', syncHome);

  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (registerSW && 'serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
