/* Service worker v2 — بسيط: يخزّن الملفات ويعمل دون إنترنت */
const CACHE = 'hajj-v2-' + '20261012';
const CORE = ['./', './index.html', './manifest.json', './logo.jpg',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    CORE.map(u => c.add(u).catch(() => {}))   // لا يفشل التثبيت بسبب ملف واحد
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const ok = url.origin === location.origin ||
             url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(r, {ignoreSearch: r.mode === 'navigate'});
    const net = fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(r, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
