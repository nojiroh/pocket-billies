/* Pocket Billies service worker: art and fonts come from the cache instantly and refresh in the background;
   code and game data always try the network first, so edits from Pocket Billies Studio show up on the next load.
   The network is asked past the browser's own cache (no-cache: the server says whether the file changed; GitHub
   Pages lets a browser keep a file 10 minutes), so a new deploy is never mixed with the last one's files. A new
   build is a new worker: it imports version.js, which names the build (PB_BUILD, update-check.js). */
importScripts('version.js');
const CACHE_PREFIX = 'pocketbillies-' + PB_VERSION_ID;
/* LD-3: a page bundle (js/<page>-<hash>.js, vite.config.js) never changes under its name, so it comes from the cache at
   once; the build lists its own here (vite.config.js stampBuild), fetched when the worker installs, so the next visit
   reads it from the cache (and the browser keeps its compiled code). Bundles of other builds are dropped */
const PRECACHE = [];
const HASHED = /\/js\/(game|studio)-[0-9a-f]{10}\.js$/;
self.addEventListener('install', e =>
  e.waitUntil(
    caches
      .open(CACHE_PREFIX + '-app')
      .then(c => c.addAll(PRECACHE.map(p => new Request(p, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
);
self.addEventListener('activate', e =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => !k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k)));
      if (PRECACHE.length) {
        const c = await caches.open(CACHE_PREFIX + '-app'),
          keep = new Set(PRECACHE.map(p => new URL(p, location.href).href));
        for (const r of await c.keys()) if (HASHED.test(new URL(r.url).pathname) && !keep.has(r.url)) await c.delete(r);
      }
      await self.clients.claim();
    })()
  )
);
self.addEventListener('fetch', e => {
  const r = e.request,
    u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const art = /\/(art|fonts)\//.test(u.pathname) && /\.(png|webp|svg|woff2|jpg)$/.test(u.pathname);
  if (art) {
    e.respondWith(
      caches.open(CACHE_PREFIX + '-art').then(async c => {
        const hit = await c.match(r);
        const net = fetch(new Request(r, { cache: 'no-cache' }))
          .then(res => {
            if (res.ok) c.put(r, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  if (HASHED.test(u.pathname)) {
    e.respondWith(
      caches.open(CACHE_PREFIX + '-app').then(async c => {
        const hit = await c.match(r);
        if (hit) return hit;
        const res = await fetch(r);
        if (res.ok) c.put(r, res.clone());
        return res;
      })
    );
    return;
  }
  /* a page load can't be copied with options: its address is asked for instead */
  const fresh =
    r.mode === 'navigate' ? new Request(r.url, { cache: 'no-cache' }) : new Request(r, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh)
      .then(res => {
        if (res.ok) {
          const cl = res.clone();
          caches.open(CACHE_PREFIX + '-app').then(c => c.put(r, cl));
        }
        return res;
      })
      .catch(() => caches.match(r))
  );
});
