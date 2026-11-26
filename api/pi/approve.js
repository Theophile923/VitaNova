// VitaNova — serveur de paiement Pi : ETAPE 1 « Approbation »
// Emplacement dans le depot GitHub : api/pi/approve.js
// Necessite la variable secrete PI_API_KEY (reglee dans Vercel, jamais ecrite dans le code).
// Version diagnostic : en cas de refus, la reponse contient aussi le code et le message renvoyes par Pi
// (jamais la cle secrete), pour comprendre la cause.

const PI_API = "https://api.minepi.com/v2";
// Sites autorises a appeler ce serveur : le site VitaNova (Vercel), la page GitHub Pages et les adresses Pi (xxx.pinet.com).
const ALLOWED_ORIGIN = /^https?:\/\/(vitanova-test\.vercel\.app|theophile923\.github\.io|[a-z0-9-]+\.pinet\.com)$/i;

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "PI_API_KEY manquante sur le serveur" });
  }

  const body = req.body || {};
  const paymentId = body.paymentId;
  if (!paymentId || typeof paymentId !== "string") {
    return res.status(400).json({ error: "paymentId manquant" });
  }

  try {
    const r = await fetch(PI_API + "/payments/" + encodeURIComponent(paymentId) + "/approve", {
      method: "POST",
      headers: { Authorization: "Key " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const piMessage = (data && (data.message || data.error_message || data.error)) || null;
      console.error("Approbation refusee par Pi :", r.status, JSON.stringify(data));
      return res.status(502).json({
        error: "Approbation refusee par Pi",
        piStatus: r.status,
        piMessage: piMessage
      });
    }
    return res.status(200).json({ ok: true, paymentId: paymentId, status: data.status || null });
  } catch (e) {
    console.error("Erreur serveur approve :", e && e.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
