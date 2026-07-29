/* Service worker: guarda la app en el dispositivo para que abra al instante
   y funcione aunque no haya internet (los datos sí necesitan conexión).
   v2: la página principal ahora es "red primero, caché de respaldo",
   para que las actualizaciones de la app lleguen solas a quien la instaló. */
const CACHE = "alerta-temprana-v2";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/icono-maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Los datos externos (EWS, adsb.lol, airplanes.live…) van siempre a la red.
  if (url.origin !== location.origin) return;

  const esPagina =
    e.request.mode === "navigate" || url.pathname.endsWith("/index.html");

  if (esPagina) {
    // Red primero: si hay internet, versión fresca (y actualizamos la copia);
    // sin internet, servimos la copia guardada.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((m) => m || caches.match("./index.html"))
        )
    );
  } else {
    // Iconos y demás: caché primero (no cambian casi nunca).
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
