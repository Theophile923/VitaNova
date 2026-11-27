// VitaNova — serveur de paiement Pi : ANNULATION d'un paiement interrompu
// Emplacement dans le depot GitHub : api/pi/cancel.js
// Necessite la variable secrete PI_API_KEY (et, facultativement, PI_API_KEY_LIVE) reglee dans Vercel.
// Sert quand un paiement a ete approuve mais n'a jamais abouti (coupure reseau, fermeture de l'application) :
// sans annulation, Pi bloque les paiements suivants de cet utilisateur.

const PI_API = "https://api.minepi.com/v2";
// Sites autorises a appeler ce serveur : le site VitaNova (Vercel), la page GitHub Pages et les adresses Pi (xxx.pinet.com).
const ALLOWED_ORIGIN = /^https?:\/\/(vitanova-test\.vercel\.app|theophile923\.github\.io|[a-z0-9-]+\.pinet\.com)$/i;
// Cles secretes (reglees dans Vercel, jamais ecrites dans le code) :
//  - PI_API_KEY      : cle de l application de TEST (sandbox, "VitaNova Test")
//  - PI_API_KEY_LIVE : cle de l application reelle creee par Pi App Studio ("VitaNova") — facultative
// Le serveur essaie chaque cle disponible ; Pi n accepte que celle de l application qui a lance le paiement.
const API_KEYS = [process.env.PI_API_KEY, process.env.PI_API_KEY_LIVE].filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

// Appelle Pi avec la premiere cle ; si Pi dit que la cle ne convient pas (401/403/404), essaie la suivante.
async function piPost(path, payload) {
  let last = null;
  for (const key of API_KEYS) {
    const r = await fetch(PI_API + path, {
      method: "POST",
      headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(function () { return {}; });
    last = { ok: r.ok, status: r.status, data: data };
    if (r.ok) return last;
    if (r.status !== 401 && r.status !== 403 && r.status !== 404) return last;
  }
  return last;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!API_KEYS.length) {
    return res.status(500).json({ error: "PI_API_KEY manquante sur le serveur" });
  }

  const body = req.body || {};
  const paymentId = body.paymentId;
  if (!paymentId || typeof paymentId !== "string") {
    return res.status(400).json({ error: "paymentId manquant" });
  }

  try {
    const out = await piPost("/payments/" + encodeURIComponent(paymentId) + "/cancel", {});
    if (!out.ok) {
      const piMessage = (out.data && (out.data.message || out.data.error_message || out.data.error)) || null;
      console.error("Annulation refusee par Pi :", out.status, JSON.stringify(out.data));
      return res.status(502).json({ error: "Annulation refusee par Pi", piStatus: out.status, piMessage: piMessage });
    }
    return res.status(200).json({ ok: true, paymentId: paymentId, status: out.data.status || null });
  } catch (e) {
    console.error("Erreur serveur cancel :", e && e.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
