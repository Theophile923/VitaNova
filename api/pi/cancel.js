// VitaNova — serveur de paiement Pi : ANNULATION d'un paiement interrompu
// Emplacement dans le depot GitHub : api/pi/cancel.js
// Necessite la variable secrete PI_API_KEY (reglee dans Vercel, jamais ecrite dans le code).
// Sert quand un paiement a ete approuve mais n'a jamais abouti (coupure reseau, fermeture de l'application) :
// sans annulation, Pi bloque les paiements suivants de cet utilisateur.

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
    const r = await fetch(PI_API + "/payments/" + encodeURIComponent(paymentId) + "/cancel", {
      method: "POST",
      headers: { Authorization: "Key " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      return res.status(502).json({ error: "Annulation refusee par Pi" });
    }
    return res.status(200).json({ ok: true, paymentId: paymentId, status: data.status || null });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
