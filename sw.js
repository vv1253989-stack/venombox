const CACHE = 'white-devil-v3';
const FILES = ['./', './index.html', './manifest.json', './icon-192-1.png', './icon-512-1.png', './intro.mp4'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(FILES.map((f) => c.add(f).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Video offline chalane ke liye cache se partial (206) response banata hai
function rangeFromCache(req) {
  return caches.match(req.url).then((res) => {
    if (!res) return Response.error();
    return res.arrayBuffer().then((buf) => {
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      let s = m && m[1] ? parseInt(m[1], 10) : 0;
      let en = m && m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
      if (en >= buf.byteLength) en = buf.byteLength - 1;
      return new Response(buf.slice(s, en + 1), {
        status: 206,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'video/mp4',
          'Content-Range': 'bytes ' + s + '-' + en + '/' + buf.byteLength,
          'Content-Length': String(en - s + 1)
        }
      });
    });
  });
}

// Network first (naya update turant mile), internet na ho to cache se chale
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) {
    e.respondWith(fetch(req).catch(() => rangeFromCache(req)));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
