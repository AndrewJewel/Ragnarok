/* api/comprobar.js
  El "vigilante" de verdad: lo llama un robot de GitHub Actions cada 5
minutos (no depende de que nadie tenga la app abierta). Revisa el
canal oficial de EWS y, si hay una alerta nueva (nivel 4 o 5) que
todavia no habiamos avisado, manda una notificacion push real a
todos los dispositivos suscritos. */
const webpush = require("web-push");
const { kv } = require("@vercel/kv");

const URL_DATOS = "https://pub-49bb6a6f314c47be9b481c25e5f6ca9e.r2.dev/dashboard.json";
const CLAVE_SUSCRIPCIONES = "ragnarok:suscripciones";
const CLAVE_ULTIMO_NIVEL = "ragnarok:ultimo_nivel_avisado";

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

const r = await fetch(URL_DATOS, { cache: "no-store" });
if (!r.ok) {
res.status(200).json({ ok: false, motivo: "El EWS no respondio" });
return;
}
const d = await r.json();
const c = d.current || {};
const nivel = typeof c.emergencyLevel === "number" ? Math.min(5, Math.max(1, Math.round(c.emergencyLevel))) : 1;
const aviones = typeof c.concurrentCount === "number" ? Math.round(c.concurrentCount) : null;

const ultimoNivel = await kv.get(CLAVE_ULTIMO_NIVEL);

if (nivel < 4) {
if (ultimoNivel !== null && ultimoNivel !== undefined) await kv.del(CLAVE_ULTIMO_NIVEL);
res.status(200).json({ ok: true, nivel, avisado: false });
return;
}

if (ultimoNivel === nivel) {
res.status(200).json({ ok: true, nivel, avisado: false, motivo: "ya se habia avisado este nivel" });
return;
}

const suscripciones = (await kv.hgetall(CLAVE_SUSCRIPCIONES)) || {};
const claves = Object.keys(suscripciones);

const alarma = "\u{1F6A8}"; // rotating light
const aviso = "⚠️"; // warning sign (unicode escape, ascii-safe to type)
const titulo = nivel === 5 ? `${alarma} EMERGENCIA NIVEL 5` : `${aviso} Alerta nivel 4`;
const cuerpo = aviones !== null
? `${aviones} jets en el aire ahora mismo. Toca para ver la verificacion cruzada en Ragnarok.`
: "Actividad de jets muy por encima de lo normal. Toca para ver los detalles en Ragnarok.";
const payload = JSON.stringify({ titulo, cuerpo, nivel });

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
// El navegador dio de baja esa suscripcion; la limpiamos.
await kv.hdel(CLAVE_SUSCRIPCIONES, endpointKey);
}
}
}

await kv.set(CLAVE_ULTIMO_NIVEL, nivel);
res.status(200).json({ ok: true, nivel, avisado: true, enviados, fallidos, totalSuscripciones: claves.length });
} catch (err) {
res.status(500).json({ ok: false, error: String(err && err.message || err) });
}
};
