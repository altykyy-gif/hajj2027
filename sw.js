/* PWA offline cache — hajj pilgrims 2027 */
const STATIC_CACHE = 'hajj-benghazi-2027-v1';
const FONT_CACHE = 'hajj-benghazi-fonts-v1';
const CORE = ['./', './index.html', './manifest.json', './logo.jpg', './icon-192.png', './icon-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE);
    await cache.put(new URL('./index.html', self.registration.scope).href,
      await (await cache.match('./index.html')).clone());
    // Cache Cairo and its font files during the first online installation when reachable.
    try {
      const cssResponse = await fetch(FONT_CSS, {mode: 'cors', cache: 'reload'});
      if (cssResponse.ok) {
        const cacheFonts = await caches.open(FONT_CACHE);
        await cacheFonts.put(FONT_CSS, cssResponse.clone());
        const css = await cssResponse.clone().text();
        const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1].replace(/^['"]|['"]$/g, ''));
        await Promise.all([...new Set(urls)].map(async url => {
          try {
            const r = await fetch(url, {mode: 'cors'});
            if (r.ok) await cacheFonts.put(url, r.clone());
          } catch (_) {}
        }));
      }
    } catch (_) { /* Offline or font provider unavailable: app still installs. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, FONT_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('hajj-benghazi-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      // A common canonical fallback for offline navigation to the site's root.
      const canonical = new URL('./index.html', self.registration.scope).href;
      await cache.put(canonical, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (await caches.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
  }
}

async function fontCacheFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
      event.respondWith(networkFirst(request));
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) { return Response.error(); }
    })());
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontCacheFirst(request));
  }
});
