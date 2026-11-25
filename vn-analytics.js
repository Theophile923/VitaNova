/* VitaNova — mesure d'audience anonyme (PostHog)
 * Emplacement dans le depot GitHub : vn-analytics.js (a cote de index.html)
 *
 * REGLES :
 *  - Aucune donnee personnelle : jamais de nom d'utilisateur Pi, d'adresse de portefeuille,
 *    de cle privee, de jeton, ni le contenu des formulaires. Seul un identifiant anonyme aleatoire est utilise.
 *  - Seule la cle PUBLIQUE PostHog (commence par "phc_") se met ici. Ne jamais y mettre une cle secrete.
 *  - Cle vide = analyse ETEINTE : le module ne fait rien et n'envoie rien.
 *  - Une erreur dans ce module ne doit jamais gener Pi Auth, les paiements ou les outils.
 *  - Seuls 3 modules sont suivis : smartbiz, legacyvault, buildsmart (+ la page d'accueil).
 */
(function () {
  "use strict";

  // ═══ REGLAGES (a modifier ici uniquement) ═══
  var POSTHOG_KEY = "";                          // Collez ici la cle publique PostHog (phc_...). Vide = eteint.
  var POSTHOG_HOST = "https://us.i.posthog.com"; // "https://eu.i.posthog.com" si votre projet PostHog est en Europe
  var SHOW_FEEDBACK = true;                      // true = petit bouton d'avis (5 niveaux + commentaire)
  // ═══════════════════════════════════════════

  var MODULES = { smartbiz: 1, legacyvault: 1, buildsmart: 1 };
  var BLOCKED = /user|name|wallet|token|key|address|email|password|secret/i;
  var state = { module: null, used: false, completed: false, abandonedSent: false };

  function store() {
    try { var k = "__vn_t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; }
    catch (e) { return null; }
  }
  var ls = store();

  function optedOut() { try { return !!(ls && ls.getItem("vn_analytics_off") === "1"); } catch (e) { return false; } }
  function dnt() { try { return navigator.doNotTrack === "1" || window.doNotTrack === "1"; } catch (e) { return false; } }
  function isOn() { return !!POSTHOG_KEY && !optedOut() && !dnt(); }

  function anonId() {
    try {
      var id = ls && ls.getItem("vn_anon_id");
      if (!id) {
        var a = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(a);
        id = Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        if (ls) ls.setItem("vn_anon_id", id);
      }
      return id;
    } catch (e) { return "anon-" + Math.random().toString(16).slice(2); }
  }

  function curLang() {
    try {
      var en = document.getElementById("lbtn-en");
      if (en) return en.classList.contains("active") ? "en" : "fr";
      return (document.documentElement.lang || "en").slice(0, 2);
    } catch (e) { return "en"; }
  }

  // Trafic de test (sandbox) : marque pour pouvoir l'exclure des statistiques.
  function isTest() {
    try {
      if (/[?&]sandbox=1/.test(location.search)) return true;
      if (sessionStorage.getItem("vitanova_sandbox") === "1") return true;
      var ao = location.ancestorOrigins;
      if (ao) for (var i = 0; i < ao.length; i++) if (/sandbox\.minepi\.com/.test(ao[i])) return true;
    } catch (e) {}
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  function clean(props) {
    var out = {};
    if (!props) return out;
    Object.keys(props).forEach(function (k) {
      if (BLOCKED.test(k)) return;
      var v = props[k], t = typeof v;
      if (t === "string") out[k] = v.slice(0, 500);
      else if (t === "number" || t === "boolean") out[k] = v;
    });
    return out;
  }

  function send(event, props) {
    try {
      if (!isOn()) return;
      var p = clean(props);
      p.module = state.module || "home";
      p.lang = curLang();
      p.is_test = isTest();
      p.path = location.pathname;
      var body = JSON.stringify({
        api_key: POSTHOG_KEY,
        event: event,
        distinct_id: anonId(),
        properties: p,
        timestamp: new Date().toISOString()
      });
      var url = POSTHOG_HOST.replace(/\/+$/, "") + "/capture/";
      var ok = false;
      if (navigator.sendBeacon) {
        try { ok = navigator.sendBeacon(url, new Blob([body], { type: "text/plain" })); } catch (e) { ok = false; }
      }
      if (!ok && window.fetch) {
        fetch(url, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* jamais d'erreur visible */ }
  }

  // ─── Avis de satisfaction (discret, 5 niveaux + commentaire) ───
  function injectStyle() {
    if (document.getElementById("vn-style")) return;
    var st = document.createElement("style"); st.id = "vn-style";
    st.textContent =
      "#vn-fb-chip{position:fixed;right:10px;bottom:76px;z-index:400;background:#1C1F35;color:#E8EAF6;border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:6px 11px;font:600 11px 'Segoe UI',Arial,sans-serif;cursor:pointer;opacity:.75}" +
      "#vn-fb-chip:hover{opacity:1}" +
      "#vn-fb-box{position:fixed;right:10px;bottom:76px;z-index:401;width:260px;max-width:calc(100vw - 20px);background:#161929;color:#E8EAF6;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px;font:12px 'Segoe UI',Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);display:none}" +
      "#vn-fb-box .vn-t{font-weight:800;margin-bottom:8px}" +
      "#vn-fb-box .vn-r{display:flex;gap:6px;justify-content:space-between;margin-bottom:8px}" +
      "#vn-fb-box .vn-r button{flex:1;font-size:20px;background:#0D0F1E;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:5px 0;cursor:pointer}" +
      "#vn-fb-box .vn-r button.sel{border-color:#FFB300;background:rgba(255,179,0,.18)}" +
      "#vn-fb-box textarea{width:100%;height:56px;background:#0D0F1E;color:#E8EAF6;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px;font:12px 'Segoe UI',Arial,sans-serif;resize:none}" +
      "#vn-fb-box .vn-n{font-size:10px;color:#9CA3AF;margin:4px 0 8px}" +
      "#vn-fb-box .vn-b{display:flex;gap:6px}" +
      "#vn-fb-box .vn-b button{flex:1;padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#0D0F1E;color:#E8EAF6;font-weight:700;cursor:pointer;font-size:12px}" +
      "#vn-fb-box .vn-b button.vn-go{background:#FFB300;color:#1A1A2E;border-color:#FFB300}";
    document.head.appendChild(st);
  }

  function setupFeedback() {
    try {
      if (!SHOW_FEEDBACK || !isOn() || !state.module || !MODULES[state.module]) return;
      var doneKey = "vn_feedback_" + state.module;
      if (ls && ls.getItem(doneKey) === "1") return;
      injectStyle();
      var rating = 0;
      var faces = ["\uD83D\uDE1E", "\uD83D\uDE41", "\uD83D\uDE10", "\uD83D\uDE42", "\uD83D\uDE0D"];
      var T = {
        fr: { chip: "Votre avis ?", title: "Votre avis sur cet outil", ph: "Commentaire (facultatif)", note: "N'ecrivez aucune information personnelle.", send: "Envoyer", close: "Fermer", thanks: "Merci !" },
        en: { chip: "Feedback?", title: "Your feedback on this tool", ph: "Comment (optional)", note: "Please do not write any personal information.", send: "Send", close: "Close", thanks: "Thank you!" }
      };
      var chip = document.createElement("button"); chip.id = "vn-fb-chip"; chip.type = "button";
      var box = document.createElement("div"); box.id = "vn-fb-box";
      function build() {
        var t = T[curLang()] || T.en;
        chip.textContent = t.chip;
        box.innerHTML = "";
        var title = document.createElement("div"); title.className = "vn-t"; title.textContent = t.title; box.appendChild(title);
        var row = document.createElement("div"); row.className = "vn-r";
        faces.forEach(function (f, i) {
          var b = document.createElement("button"); b.type = "button"; b.textContent = f; b.setAttribute("aria-label", String(i + 1) + "/5");
          if (rating === i + 1) b.className = "sel";
          b.onclick = function () { rating = i + 1; build(); };
          row.appendChild(b);
        });
        box.appendChild(row);
        var ta = document.createElement("textarea"); ta.maxLength = 500; ta.placeholder = t.ph; ta.id = "vn-fb-text"; box.appendChild(ta);
        var note = document.createElement("div"); note.className = "vn-n"; note.textContent = t.note; box.appendChild(note);
        var btns = document.createElement("div"); btns.className = "vn-b";
        var close = document.createElement("button"); close.type = "button"; close.textContent = t.close;
        close.onclick = function () { box.style.display = "none"; chip.style.display = "block"; };
        var go = document.createElement("button"); go.type = "button"; go.className = "vn-go"; go.textContent = t.send;
        go.onclick = function () {
          if (!rating) return;
          var txt = (document.getElementById("vn-fb-text") || {}).value || "";
          send("satisfaction_submitted", { rating: rating, comment: txt.slice(0, 500) });
          try { if (ls) ls.setItem(doneKey, "1"); } catch (e) {}
          box.textContent = t.thanks;
          setTimeout(function () { box.style.display = "none"; }, 1800);
        };
        btns.appendChild(close); btns.appendChild(go); box.appendChild(btns);
      }
      chip.onclick = function () { build(); chip.style.display = "none"; box.style.display = "block"; };
      build();
      document.body.appendChild(chip); document.body.appendChild(box);
    } catch (e) {}
  }

  // ─── Interface publique ───
  var VN = {
    init: function (module) {
      try {
        state.module = module || "home";
        if (state.module === "home") {
          send("app_opened");
          document.addEventListener("click", function (ev) {
            try {
              var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
              if (!a) return;
              var m = /(smartbiz|legacyvault|buildsmart)\.html/.exec(a.getAttribute("href") || "");
              if (m) send("module_selected", { target: m[1] });
            } catch (e) {}
          }, true);
          return;
        }
        send("module_opened");
        var used = function () { if (!state.used) { state.used = true; send("module_used"); } };
        document.addEventListener("input", used, true);
        document.addEventListener("change", used, true);
        var leave = function () {
          if (state.used && !state.completed && !state.abandonedSent) { state.abandonedSent = true; send("module_abandoned"); }
        };
        window.addEventListener("pagehide", leave);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") leave(); });
        setupFeedback();
      } catch (e) {}
    },
    track: function (name, props) { send(name, props); },
    complete: function () {
      try { if (!state.completed) { state.completed = true; send("module_completed"); } } catch (e) {}
    },
    payment: function (stage) {
      try {
        var map = { initiated: "payment_initiated", confirmed: "payment_confirmed", cancelled: "payment_cancelled", error: "payment_error" };
        if (map[stage]) send(map[stage]);
      } catch (e) {}
    },
    optOut: function () { try { if (ls) ls.setItem("vn_analytics_off", "1"); } catch (e) {} },
    optIn: function () { try { if (ls) ls.removeItem("vn_analytics_off"); } catch (e) {} }
  };
  window.VN = VN;
})();
