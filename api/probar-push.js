/* api/probar-push.js
   Endpoint de prueba: manda una notificacion push real a todas las
   suscripciones guardadas, para comprobar que el sistema funciona de
   verdad de punta a punta (no cambia el nivel de alerta ni el historial,
   es solo un mensaje de prueba). Se llama a mano cuando se quiera probar. */
const webpush = require("web-push");
const { kv } = require("@vercel/kv");

const CLAVE_SUSCRIPCIONES = "ragnarok:suscripciones";

module.exports = async (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      res.status(500).json({ ok: false, error: "Faltan las llaves VAPID en las variables de entorno" });
      return;
    }
    webpush.setVapidDetails(
      "mailto:andres.chaves.joya@gmail.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const suscripciones = (await kv.hgetall(CLAVE_SUSCRIPCIONES)) || {};
    const claves = Object.keys(suscripciones);
    const payload = JSON.stringify({
      titulo: "Prueba de Ragnarok",
      cuerpo: "Si ves esto, los avisos con la app cerrada funcionan bien.",
      nivel: 0
    });

    let enviados = 0, fallidos = 0;
    for (const endpointKey of claves) {
      let sub = suscripciones[endpointKey];
      try {
        if (typeof sub === "string") sub = JSON.parse(sub);
        await webpush.sendNotification(sub, payload);
        enviados++;
      } catch (err) {
        fallidos++;
        const codigo = err && (err.statusCode || err.status);
        if (codigo === 404 || codigo === 410) {
          await kv.hdel(CLAVE_SUSCRIPCIONES, endpointKey);
        }
      }
    }
    res.status(200).json({ ok: true, enviados, fallidos, totalSuscripciones: claves.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
};

