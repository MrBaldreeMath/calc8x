/* sw.js — keeps the phone/web version working offline. `npm run web` stamps VERSION and the FILES list,
   so phones download the new files once after an update. Unstamped (VERSION 'dev') it asks the server first. */
const VERSION = '202611010157';
const FILES = ["./","app-cabri.js","app-celsheet.js","app-periodic.js","app-scitools.js","cathelp.js","engine.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","index.html","manifest.webmanifest","mirror.js","numeric.js","style.css","tifile.js","ui-apps.js","ui-core.js","ui-extra.js","ui-graph.js","ui-main.js","ui-prgm.js","ui-stat.js"];
const CACHE = 'calc8x-' + VERSION;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const cached = () => caches.match(e.request, { ignoreSearch: true });
  if (VERSION === 'dev') {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(cached));
    return;
  }
  e.respondWith(cached().then(r => r || fetch(e.request)));
});
