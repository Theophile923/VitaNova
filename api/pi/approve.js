// VitaNova — serveur de paiement Pi : ETAPE 1 « Approbation »
// Emplacement dans le depot GitHub : api/pi/approve.js
// Cles secretes reglees dans Vercel (jamais ecrites dans le code) :
//  - PI_API_KEY      : cle de l application de TEST (sandbox, "VitaNova Test")
//  - PI_API_KEY_LIVE : cle de l application creee par Pi App Studio ("VitaNova") — facultative
// Version diagnostic : l adresse /api/pi/approve?diag=1 affiche les derniers evenements (jamais les cles ni les identifiants de paiement).

const PI_API = "https://api.minepi.com/v2";
// Sites autorises a appeler ce serveur : le site VitaNova (Vercel), la page GitHub Pages et les adresses Pi (xxx.pinet.com).
const ALLOWED_ORIGIN = /^https?:\/\/(vitanova-test\.vercel\.app|theophile923\.github\.io|[a-z0-9-]+\.pinet\.com)$/i;
const API_KEYS = [
  { name: "PI_API_KEY", value: process.env.PI_API_KEY },
  { name: "PI_API_KEY_LIVE", value: process.env.PI_API_KEY_LIVE },
].filter(function (k) { return !!k.value; });

// Journal en memoire (les 10 derniers evenements). Meilleur effort : il peut se vider quand Vercel redemarre le serveur.
const events = [];
function record(ev) {
  events.unshift(Object.assign({ t: new Date().toISOString() }, ev));
  if (events.length > 10) events.pop();
}

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
  for (const k of API_KEYS) {
    const r = await fetch(PI_API + path, {
      method: "POST",
      headers: { Authorization: "Key " + k.value, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(function () { return {}; });
    last = { ok: r.ok, status: r.status, data: data, keyName: k.name };
    if (r.ok) return last;
    if (r.status !== 401 && r.status !== 403 && r.status !== 404) return last;
  }
  return last;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  const origin = req.headers.origin || null;
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method === "GET") {
    let diag = false;
    try { diag = new URL(req.url, "http://localhost").searchParams.get("diag") === "1"; } catch (e) {}
    if (diag) {
      return res.status(200).json({
        keysConfigured: { PI_API_KEY: !!process.env.PI_API_KEY, PI_API_KEY_LIVE: !!process.env.PI_API_KEY_LIVE },
        events: events,
      });
    }
    record({ type: "GET-controle", origin: origin, originAllowed: !!(origin && ALLOWED_ORIGIN.test(origin)) });
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!API_KEYS.length) {
    record({ type: "POST", origin: origin, result: "aucune cle configuree" });
    return res.status(500).json({ error: "PI_API_KEY manquante sur le serveur" });
  }

  const body = req.body || {};
  const paymentId = body.paymentId;
  if (!paymentId || typeof paymentId !== "string") {
    record({ type: "POST", origin: origin, result: "paymentId manquant" });
    return res.status(400).json({ error: "paymentId manquant" });
  }

  try {
    const out = await piPost("/payments/" + encodeURIComponent(paymentId) + "/approve", {});
    const piMessage = (out.data && (out.data.message || out.data.error_message || out.data.error)) || null;
    record({
      type: "POST-approve", origin: origin, originAllowed: !!(origin && ALLOWED_ORIGIN.test(origin)),
      ok: out.ok, piStatus: out.status, piMessage: out.ok ? null : piMessage, cleUtilisee: out.keyName,
    });
    if (!out.ok) {
      console.error("Approbation refusee par Pi :", out.status, JSON.stringify(out.data));
      return res.status(502).json({ error: "Approbation refusee par Pi", piStatus: out.status, piMessage: piMessage });
    }
    return res.status(200).json({ ok: true, paymentId: paymentId, status: out.data.status || null });
  } catch (e) {
    record({ type: "POST-approve", origin: origin, result: "erreur serveur: " + (e && e.message) });
    console.error("Erreur serveur approve :", e && e.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
