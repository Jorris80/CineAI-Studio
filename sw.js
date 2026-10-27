/* CineAI Studio — Service Worker (mode offline PWA) */
const VERSION = 'cineai-v1.2.1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const IMG_CACHE = 'cineai-img-v1';
const MAX_IMG = 150;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimCache(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // API (POST ke Apps Script) tidak pernah di-cache oleh SW
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('script.googleusercontent.com')) return;

  // Navigasi & aset aplikasi: network-first, fallback cache (offline)
  if (req.mode === 'navigate' || url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
        return res;
      }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Gambar (poster, storyboard, avatar dari Google Drive): cache-first + batas jumlah
  if (req.destination === 'image' || /googleusercontent\.com|drive\.google\.com\/thumbnail/.test(url.href)) {
    e.respondWith(
      caches.open(IMG_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); trimCache(IMG_CACHE, MAX_IMG); }
        return res;
      }).catch(() => hit)))
    );
  }
  // Video tidak di-cache (ukuran besar, kuota penyimpanan perangkat)
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
