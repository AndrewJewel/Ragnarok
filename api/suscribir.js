/* api/suscribir.js
   Guarda en Vercel KV la "suscripcion push" que el navegador genera cuando
   el usuario activa "Avisos con la app cerrada". Cada suscripcion es un
   objeto {endpoint, keys:{p256dh, auth}} unico por dispositivo/navegador.
   La guardamos en un hash, usando el endpoint como clave, para que
   activarla dos veces desde el mismo dispositivo no duplique nada. */
const { kv } = require("@vercel/kv");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Metodo no permitido" });
    return;
  }
  try {
    const sub = req.body;
    if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint) {
      res.status(400).json({ ok: false, error: "Suscripcion invalida" });
      return;
    }
    await kv.hset("ragnarok:suscripciones", { [sub.endpoint]: JSON.stringify(sub) });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
};
