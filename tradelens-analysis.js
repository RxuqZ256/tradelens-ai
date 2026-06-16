/* =====================================================================
   TradeLens AI – Analyse-Datenschicht (Phase 4)
   ---------------------------------------------------------------------
   Ruft die Edge Function "analyze-chart" auf (der Browser ruft NIE den
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

  // Deutsche, nicht-technische Meldungen je error_code
  var MESSAGES = {
    unauthorized: "Keine aktive Anmeldung gefunden.",
    invalid_request: "Die Anfrage war ungueltig.",
    upload_not_found: "Der Upload wurde nicht gefunden.",
    rate_limited: "Dein taegliches Analyselimit ist erreicht. Versuche es morgen erneut.",
    model_not_configured: "Die Analyse ist derzeit nicht verfuegbar.",
    storage_error: "Der Chart konnte nicht geladen werden.",
    provider_error: "Die Analyse konnte nicht durchgefuehrt werden. Bitte erneut versuchen.",
    provider_timeout: "Die Analyse hat zu lange gedauert. Bitte erneut versuchen.",
    model_refusal: "Zu diesem Bild konnte keine Analyse erstellt werden.",
    validation_failed: "Das Ergebnis war nicht schluessig. Bitte erneut versuchen.",
    internal_error: "Es ist ein Fehler aufgetreten. Bitte erneut versuchen."
  };
  function message(code) { return MESSAGES[code] || MESSAGES.internal_error; }

  // Edge Function direkt aufrufen (volle Kontrolle ueber JSON bei Fehlerstatus)
  function analyze(uploadId, opts) {
    opts = opts || {};
    if (!isConfigured()) return Promise.resolve({ ok: false, error_code: "model_not_configured" });
    return accessToken().then(function (tok) {
      if (!tok) return { ok: false, error_code: "unauthorized" };
      var body = { upload_id: uploadId, force_reanalysis: opts.force === true };
      if (opts.confirmed_instrument) body.confirmed_instrument = opts.confirmed_instrument;
      if (opts.confirmed_timeframe) body.confirmed_timeframe = opts.confirmed_timeframe;
      var url = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/analyze-chart";
      return fetch(url, {
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
              return { ok: true, status: j.status, result: j.result || null, analysis_id: j.analysis_id || null, cached: !!j.cached };
            }
            return { ok: false, error_code: (j && j.error_code) || "internal_error", analysis_id: (j && j.analysis_id) || null };
          });
      }).catch(function () { return { ok: false, error_code: "provider_error" }; });
    });
  }

  // Neueste eigene Analyse zu einem Upload (RLS) – zum Wiederherstellen
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
    message: message
  };
})();
