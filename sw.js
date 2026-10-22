// Offline support: cache the app shell, serve it cache-first.
// Bump VERSION whenever any file below changes so phones pick up the update.
const VERSION = 'whatif-v18';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/game.css',
  'js/app.js',
  'js/content.js',
  'js/db.js',
  'js/flow.js',
  'js/now.js',
  'js/ladder.js',
  'js/game/audio.js',
  'js/game/avatar.js',
  'js/game/course.js',
  'js/game/engine.js',
  'js/game/index.js',
  'js/game/kit.js',
  'js/game/hub.js',
  'js/game/hubData.js',
  'js/game/layout.js',
  'js/game/props.js',
  'js/game/replay.js',
  'js/home.js',
  'js/lock.js',
  'js/logic.js',
  'js/main.js',
  'js/mind/index.js',
  'js/mind/story.js',
  'js/nav.js',
  'js/report.js',
  'js/safety.js',
  'js/screens.js',
  'js/sketch.js',
  'js/store.js',
  'js/storyView.js',
  'js/theme.js',
  'js/ui.js',
  'js/vendor/three.module.min.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Opening the app (its own address) gets the cached shell; any other page
  // on the same server (dev tools, tests) loads normally.
  const scope = new URL(self.registration.scope).pathname;
  const path = new URL(req.url).pathname;
  if (req.mode === 'navigate' && (path === scope || path === `${scope}index.html`)) {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
    return;
  }
  if (req.mode === 'navigate') return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
