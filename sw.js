/* Calc8X moved to https://calc.hippasusmath.com/. This replaces the old offline copy on phones that installed the
   github.io version: it deletes the saved files, removes itself and sends open pages to the new address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => Promise.all(cs.map(c => c.navigate('https://calc.hippasusmath.com/').catch(() => { })))));
});
