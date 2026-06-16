/* =====================================================================
   TradeLens AI – Analyse-Datenschicht (Phase 4)
   ---------------------------------------------------------------------
   Ruft die deployte Edge Function (CFG.ANALYZE_FUNCTION, Default
   "smooth-endpoint") auf (der Browser ruft NIE den
   Modellanbieter). Sendet nur { upload_id, force_reanalysis,
   confirmed_instrument?, confirmed_timeframe? }. Liest eigene Analysen
   (RLS) zum Wiederherstellen nach Reload. Kein API-Key im Frontend.

   Abhaengigkeiten (vorher laden): config -> supabase -> auth -> data ->
   upload -> diese Datei. Session wird ueber storageKey "tradelens_auth"
   geteilt; das JWT geht als Bearer-Token an die Function.
   ===================================================================== */
(function () {
  "use strict";
  var CFG = window.TRADELENS_CONFIG || {};

  function isConfigured() {
    var u = CFG.SUPABASE_URL, k = CFG.SUPABASE_ANON_KEY;
    return !!(u && k && /^https:\/\/.+/.test(u));
  }

  var _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient || !isConfigured()) return null;
    try {
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" }
      });
    } catch (e) { console.error("[TLAnalysis] init:", e); _client = null; }
    return _client;
  }

  function accessToken() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session && r.data.session.access_token) || null;
    }).catch(function () { return null; });
  }

  var MESSAGES = {
    unauthorized: "Keine aktive Anmeldung gefunden.",
    invalid_request: "Die Anfrage war ungueltig.",
    upload_not_found: "Der Upload wurde nicht gefunden.",
    rate_limited: "Dein taegliches Analyselimit ist erreicht. Versuche es morgen erneut.",
    model_not_configured: "Die Analyse ist derzeit nicht verfuegbar.",
    storage_error: "Der Chart konnte nicht geladen werden.",
    provider_error: "Der KI-Dienst hat die Analyse abgelehnt oder war nicht erreichbar. Bitte erneut versuchen.",
    provider_timeout: "Die Analyse hat zu lange gedauert. Bitte erneut versuchen.",
    model_refusal: "Zu diesem Bild konnte keine Analyse erstellt werden.",
    validation_failed: "Das Ergebnis war nicht schluessig. Bitte erneut versuchen.",
    function_not_deployed: "Die Analyse-Funktion ist nicht erreichbar. Bitte spaeter erneut versuchen.",
    network_error: "Keine Verbindung zum Analyse-Dienst. Bitte Internetverbindung pruefen.",
    internal_error: "Es ist ein Fehler aufgetreten. Bitte erneut versuchen."
  };
  function message(code) { return MESSAGES[code] || MESSAGES.internal_error; }

  /* Fehlercode aus HTTP-Status ableiten, wenn die Antwort keinen eigenen
     error_code liefert (z. B. wenn die Function gar nicht erreicht wird). */
  function inferCode(status, payload) {
    if (payload && payload.error_code) return payload.error_code;
    if (status === 404) return "function_not_deployed";
    if (status === 401 || status === 403) return "unauthorized";
    if (status === 429) return "rate_limited";
    if (status === 400) return "invalid_request";
    return "internal_error";
  }

  /* Slug der deployten Edge Function (konfigurierbar, Default: smooth-endpoint). */
  function functionUrl() {
    var slug = CFG.ANALYZE_FUNCTION || "smooth-endpoint";
    return CFG.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/" + slug;
  }

  var loading = {
    depth: 0,
    timer: null,
    step: 0,
    button: null,
    buttonHtml: null,
    buttonDisabled: false
  };
  var LOADING_STEPS = [
    "Chart wird sicher geladen …",
    "Marktstruktur wird erkannt …",
    "Liquidität und FVG werden geprüft …",
    "Premium- und Discount-Zonen werden bewertet …",
    "Trade-Setup und Risiko werden validiert …"
  ];

  function injectLoadingStyles() {
    if (document.getElementById("tl-ai-loading-style")) return;
    var style = document.createElement("style");
    style.id = "tl-ai-loading-style";
    style.textContent =
      ".tl-ai-loading{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,6,23,.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease}"+
      ".tl-ai-loading.on{opacity:1;visibility:visible}"+
      ".tl-ai-loading-card{width:min(340px,92vw);padding:30px 22px 25px;text-align:center;border-radius:24px;border:1px solid rgba(0,229,255,.48);background:linear-gradient(160deg,rgba(8,18,42,.98),rgba(4,7,20,.98));box-shadow:0 0 42px rgba(0,229,255,.18),0 0 70px rgba(124,58,237,.13)}"+
      ".tl-ai-loader{position:relative;width:112px;height:112px;margin:0 auto 20px}"+
      ".tl-ai-loader-ring{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:#00e5ff;border-right-color:rgba(0,229,255,.35);animation:tlAiSpin 1.15s linear infinite;filter:drop-shadow(0 0 8px rgba(0,229,255,.65))}"+
      ".tl-ai-loader-ring.r2{inset:12px;border-top-color:#8b5cf6;border-right-color:rgba(139,92,246,.35);animation-duration:1.65s;animation-direction:reverse}"+
      ".tl-ai-loader-core{position:absolute;inset:31px;border-radius:50%;display:grid;place-items:center;font:800 18px Orbitron,Saira,sans-serif;color:#eaffff;background:radial-gradient(circle at 38% 32%,#bff6ff 0,#00e5ff 34%,#263aa2 75%,#101633 100%);box-shadow:0 0 24px rgba(0,229,255,.72);animation:tlAiPulse 1.8s ease-in-out infinite}"+
      ".tl-ai-loading-title{font:700 17px Saira,sans-serif;letter-spacing:1px;color:#f8fafc}"+
      ".tl-ai-loading-status{min-height:42px;margin-top:8px;color:#94a3b8;font:600 14px Rajdhani,Saira,sans-serif;line-height:1.45}"+
      ".tl-ai-loading-dots{display:flex;justify-content:center;gap:6px;margin-top:14px}"+
      ".tl-ai-loading-dots i{width:6px;height:6px;border-radius:50%;background:#00e5ff;animation:tlAiDot 1.2s ease-in-out infinite}"+
      ".tl-ai-loading-dots i:nth-child(2){animation-delay:.16s;background:#6d8cff}"+
      ".tl-ai-loading-dots i:nth-child(3){animation-delay:.32s;background:#8b5cf6}"+
      ".tl-ai-loading-note{margin-top:15px;color:#52607a;font:500 11px Rajdhani,Saira,sans-serif}"+
      "@keyframes tlAiSpin{to{transform:rotate(360deg)}}@keyframes tlAiPulse{50%{transform:scale(1.08);box-shadow:0 0 34px rgba(0,229,255,.9)}}@keyframes tlAiDot{0%,70%,100%{transform:translateY(0);opacity:.35}35%{transform:translateY(-6px);opacity:1}}"+
      "@media(prefers-reduced-motion:reduce){.tl-ai-loader-ring,.tl-ai-loader-core,.tl-ai-loading-dots i{animation-duration:2.8s}}";
    document.head.appendChild(style);
  }

  function ensureLoadingNode() {
    injectLoadingStyles();
    var node = document.getElementById("tl-ai-loading");
    if (node) return node;
    node = document.createElement("div");
    node.id = "tl-ai-loading";
    node.className = "tl-ai-loading";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-label", "KI-Analyse läuft");
    node.innerHTML =
      '<div class="tl-ai-loading-card">'+
        '<div class="tl-ai-loader"><div class="tl-ai-loader-ring"></div><div class="tl-ai-loader-ring r2"></div><div class="tl-ai-loader-core">AI</div></div>'+
        '<div class="tl-ai-loading-title">KI-ANALYSE LÄUFT</div>'+
        '<div class="tl-ai-loading-status" id="tl-ai-loading-status">'+LOADING_STEPS[0]+'</div>'+
        '<div class="tl-ai-loading-dots"><i></i><i></i><i></i></div>'+
        '<div class="tl-ai-loading-note">Das kann je nach Chart bis zu einer Minute dauern.</div>'+
      '</div>';
    document.body.appendChild(node);
    return node;
  }

  function findAnalysisButton() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (txt.indexOf("weiter zur") >= 0 && txt.indexOf("analyse") >= 0) return buttons[i];
      if (txt.indexOf("analyse starten") >= 0 || txt.indexOf("ki-analyse starten") >= 0) return buttons[i];
    }
    return null;
  }

  function showLoading() {
    loading.depth += 1;
    if (loading.depth > 1) return;
    var node = ensureLoadingNode();
    loading.step = 0;
    var status = document.getElementById("tl-ai-loading-status");
    if (status) status.textContent = LOADING_STEPS[0];
    loading.button = findAnalysisButton();
    if (loading.button) {
      loading.buttonHtml = loading.button.innerHTML;
      loading.buttonDisabled = !!loading.button.disabled;
      loading.button.disabled = true;
      loading.button.setAttribute("aria-busy", "true");
      var sp = loading.button.querySelector(".sp");
      if (sp) sp.textContent = "KI ANALYSIERT …";
    }
    requestAnimationFrame(function () { node.classList.add("on"); });
    clearInterval(loading.timer);
    loading.timer = setInterval(function () {
      loading.step = Math.min(loading.step + 1, LOADING_STEPS.length - 1);
      var s = document.getElementById("tl-ai-loading-status");
      if (s) s.textContent = LOADING_STEPS[loading.step];
    }, 6500);
  }

  function hideLoading() {
    loading.depth = Math.max(0, loading.depth - 1);
    if (loading.depth > 0) return;
    clearInterval(loading.timer);
    loading.timer = null;
    var node = document.getElementById("tl-ai-loading");
    if (node) node.classList.remove("on");
    if (loading.button) {
      loading.button.disabled = loading.buttonDisabled;
      loading.button.removeAttribute("aria-busy");
      if (loading.buttonHtml != null) loading.button.innerHTML = loading.buttonHtml;
    }
    loading.button = null;
    loading.buttonHtml = null;
  }

  function analyze(uploadId, opts) {
    opts = opts || {};
    if (!isConfigured()) return Promise.resolve({ ok: false, error_code: "model_not_configured" });
    // Der alte Vollbild-Overlay-Lader (#tl-ai-loading) kann unterdrückt werden,
    // wenn der Aufrufer bereits einen eigenen Ladescreen anzeigt.
    var useLoader = opts.suppress_loading !== true;
    if (useLoader) showLoading();
    var request = accessToken().then(function (tok) {
      if (!tok) return { ok: false, error_code: "unauthorized" };
      var body = { upload_id: uploadId, force_reanalysis: opts.force === true };
      if (opts.confirmed_instrument) body.confirmed_instrument = opts.confirmed_instrument;
      if (opts.confirmed_timeframe) body.confirmed_timeframe = opts.confirmed_timeframe;
      return fetch(functionUrl(), {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + tok,
          "apikey": CFG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(function (resp) {
        return resp.json().then(function (j) { return j; }, function () { return {}; })
          .then(function (j) {
            if (resp.ok && j && j.ok) {
              return { ok: true, status: j.status, result: j.result || null, analysis_id: j.analysis_id || null, cached: !!j.cached, http_status: resp.status };
            }
            // Server hat geantwortet, aber mit Fehler -> error_code bzw. aus Status ableiten.
            return { ok: false, error_code: inferCode(resp.status, j), analysis_id: (j && j.analysis_id) || null, http_status: resp.status };
          });
      }).catch(function () {
        // fetch selbst gescheitert (kein HTTP-Status) -> Transport-/Netzwerkfehler,
        // KEIN provider_error (das ist eine serverseitige Provider-Ablehnung).
        return { ok: false, error_code: "network_error", http_status: 0 };
      });
    }).catch(function () {
      return { ok: false, error_code: "internal_error" };
    });

    // hideLoading() nur, wenn showLoading() vorher tatsächlich gestartet wurde.
    return request.then(function (result) {
      if (useLoader) hideLoading();
      return result;
    }, function () {
      if (useLoader) hideLoading();
      return { ok: false, error_code: "internal_error" };
    });
  }

  function loadLatestForUpload(uploadId) {
    var c = client();
    if (!c || !uploadId) return Promise.resolve({ ok: false });
    return c.from("ai_analyses").select("*")
      .eq("upload_id", uploadId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(function (r) {
        if (r.error) { console.warn("[TLAnalysis] latest:", r.error.message); return { ok: false }; }
        return { ok: true, row: r.data || null };
      }).catch(function () { return { ok: false }; });
  }

  window.TLAnalysis = {
    isConfigured: isConfigured,
    analyze: analyze,
    loadLatestForUpload: loadLatestForUpload,
    message: message,
    showLoading: showLoading,
    hideLoading: hideLoading
  };
})();
