/* Service worker: guarda la app en el dispositivo para que abra al instante
   y funcione aunque no haya internet (los datos sí necesitan conexión).
   v2: la página principal ahora es "red primero, caché de respaldo",
   para que las actualizaciones de la app lleguen solas a quien la instaló.
   v3: añade avisos push reales (funcionan con la app cerrada) mandados
   por nuestro propio servidor cuando detecta una alerta. */
const CACHE = "alerta-temprana-v3";
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

/* ---------- Avisos push reales (con la app cerrada) ----------
   Nuestro propio servidor (api/comprobar.js), avisado cada 5 min por un
   robot de GitHub Actions, manda este evento cuando detecta una alerta.
   El navegador lo entrega aquí aunque la app esté completamente cerrada. */
self.addEventListener("push", (e) => {
  let datos = { titulo: "Ragnarok", cuerpo: "Hay una novedad en el sistema de alerta." };
  try {
    if (e.data) datos = { ...datos, ...e.data.json() };
  } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "iconos/icono-192.png",
      badge: "iconos/icono-192.png",
      tag: "ragnarok-alerta",
      renotify: true,
      requireInteraction: datos.nivel === 5
    })
  );
});

/* Al tocar la notificación: si ya hay una pestaña de la app abierta, la
   enfoca; si no, abre una nueva. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
