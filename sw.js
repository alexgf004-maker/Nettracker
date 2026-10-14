// Service worker de la app instalable. Siempre busca primero la versión nueva en internet (así no se queda pegada una
// versión vieja después de cada cambio) y solo usa lo guardado si no hay señal. Firebase, las fuentes y las librerías
// de otros sitios van directo a la red.
const CACHE = 'cpt-innova-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png'])).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
