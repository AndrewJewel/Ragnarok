/* api/proxy.js
   El mapa mundial y la verificacion cruzada necesitan leer adsb.lol y
   airplanes.live desde el navegador, pero esas APIs no mandan cabeceras
   CORS, asi que el navegador bloquea la peticion directa. Antes se usaban
   dos proxies publicos gratuitos (corsproxy.io y allorigins.win) para
   sortear eso: corsproxy.io ahora exige una API key de pago ("A valid API
   key is required") y allorigins.win dejo de responder (502/522). Esta
   funcion hace de proxy propio: pide la URL desde el servidor (donde no
   aplica CORS) y devuelve la respuesta tal cual con las cabeceras abiertas. */
module.exports = async (req, res) => {
  const destino = req.query.url;
  if (typeof destino !== "string" || !/^https:\/\//.test(destino)) {
    res.status(400).json({ error: "Falta el parametro url (debe empezar por https://)" });
    return;
  }
  try {
    const r = await fetch(destino, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Ragnarok-EWS/1.0)" }
    });
    const texto = await r.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(r.status).send(texto);
  } catch (err) {
    res.status(502).json({ error: String((err && err.message) || err) });
  }
};
