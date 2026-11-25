// VitaNova — serveur de paiement Pi : ETAPE 3 « Confirmation »
// Emplacement dans le depot GitHub : api/pi/complete.js
// Necessite la variable secrete PI_API_KEY (reglee dans Vercel, jamais ecrite dans le code).

const PI_API = "https://api.minepi.com/v2";
// Sites autorises a appeler ce serveur : le site VitaNova et les adresses Pi (xxx.pinet.com).
const ALLOWED_ORIGIN = /^https?:\/\/(vitanova-test\.vercel\.app|[a-z0-9-]+\.pinet\.com)$/i;

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
  const txid = body.txid;
  if (!paymentId || typeof paymentId !== "string" || !txid || typeof txid !== "string") {
    return res.status(400).json({ error: "paymentId ou txid manquant" });
  }

  try {
    const r = await fetch(PI_API + "/payments/" + encodeURIComponent(paymentId) + "/complete", {
      method: "POST",
      headers: { Authorization: "Key " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ txid: txid }),
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      return res.status(502).json({ error: "Confirmation refusee par Pi" });
    }
    return res.status(200).json({ ok: true, paymentId: paymentId, status: data.status || null });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
