/* =====================================================================
   TradeLens AI – Datenschicht (Phase 2)
   ---------------------------------------------------------------------
   Zuständig für:
     - Lesen von profiles.display_name / email / created_at
     - Lesen/Anlegen/Aktualisieren von public.user_settings
   Quelle der Wahrheit ist Supabase. Der Client hält nur einen
   benutzergebundenen Cache (siehe App, localStorage v2).

   Abhängigkeiten (in dieser Reihenfolge VOR dieser Datei laden):
     1) tradelens-config.js   -> window.TRADELENS_CONFIG
     2) supabase-js (UMD)      -> window.supabase
     3) tradelens-auth.js      -> window.TLAuth
   Diese Datei nutzt KEINEN Service-Role-Key. Sie teilt sich die Session
   (storageKey "tradelens_auth") mit der Auth-Schicht, dadurch trägt jede
   Anfrage automatisch das JWT des angemeldeten Nutzers (RLS greift).
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};

  var DEFAULTS = {
    account_currency: "EUR",
    account_size: null,
    risk_percent: 1.00,
    auto_lot_calculation: true,
    signal_type: "day",
    rr_target: 2,
    notify_signal_alerts: true,
    notify_price_alerts: true,
    notify_market_news: false,
    notify_weekly_report: true,
    appearance: "dark"
  };

  function isConfigured() {
    var u = CFG.SUPABASE_URL, k = CFG.SUPABASE_ANON_KEY;
    if (!u || !k) return false;
    return /^https:\/\/.+/.test(u);
  }

  var _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!isConfigured()) return null;
    try {
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "tradelens_auth"
        }
      });
    } catch (e) {
      console.error("[TLData] Client konnte nicht initialisiert werden:", e);
      _client = null;
    }
    return _client;
  }

  function currentUser() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession()
      .then(function (r) {
        var s = r && r.data && r.data.session;
        if (!s || !s.user) return null;
        return { id: s.user.id, email: s.user.email || null };
      })
      .catch(function () { return null; });
  }

  function loadProfileMeta(uid) {
    var c = client();
    if (!c || !uid) return Promise.resolve(null);
    return c.from("profiles")
      .select("display_name,email,created_at")
      .eq("id", uid)
      .maybeSingle()
      .then(function (r) {
        if (r.error) { console.warn("[TLData] profiles:", r.error.message); return null; }
        return r.data || null;
      })
      .catch(function (e) { console.warn("[TLData] profiles:", e); return null; });
  }

  function loadSettings(uid) {
    var c = client();
    if (!c || !uid) return Promise.resolve({ ok: false, data: null, offline: true });
    return c.from("user_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
      .then(function (r) {
        if (r.error) {
          console.warn("[TLData] settings select:", r.error.message);
          return { ok: false, data: null, error: r.error, offline: true };
        }
        if (r.data) return { ok: true, data: r.data, created: false };
        var row = Object.assign({ user_id: uid }, DEFAULTS);
        return c.from("user_settings").insert(row).select("*").single()
          .then(function (ins) {
            if (ins.error) {
              console.warn("[TLData] settings insert:", ins.error.message);
              return { ok: false, data: null, error: ins.error, offline: true };
            }
            return { ok: true, data: ins.data, created: true };
          });
      })
      .catch(function (e) {
        console.warn("[TLData] settings:", e);
        return { ok: false, data: null, error: e, offline: true };
      });
  }

  function saveSettings(uid, partial) {
    var c = client();
    if (!c || !uid) return Promise.resolve({ ok: false, error: new Error("not_ready") });
    if (!partial || typeof partial !== "object") {
      return Promise.resolve({ ok: false, error: new Error("invalid_payload") });
    }
    var row = Object.assign({ user_id: uid }, partial);
    return c.from("user_settings")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single()
      .then(function (r) {
        if (r.error) { console.warn("[TLData] save:", r.error.message); return { ok: false, error: r.error }; }
        return { ok: true, data: r.data };
      })
      .catch(function (e) { console.warn("[TLData] save:", e); return { ok: false, error: e }; });
  }

  window.TLData = {
    isConfigured: isConfigured,
    currentUser: currentUser,
    loadProfileMeta: loadProfileMeta,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    DEFAULTS: DEFAULTS
  };
})();

/* Übersicht: nur den tatsächlich benötigten Abstand über der festen Navigation
   lassen. Der frühere Zusatz von 220px + 90px erzeugte den großen Leerraum. */
(function injectStartpageVisibilityFix() {
  var old = document.getElementById("tradelens-startpage-visibility-fix");
  if (old) old.remove();

  var style = document.createElement("style");
  style.id = "tradelens-startpage-visibility-fix";
  style.textContent = [
    "#page-overview,#page-uebersicht,#page-dashboard{",
    "  padding-bottom:calc(94px + env(safe-area-inset-bottom))!important;",
    "  scroll-padding-bottom:calc(94px + env(safe-area-inset-bottom))!important;",
    "}",
    "#page-overview::after,#page-uebersicht::after,#page-dashboard::after{",
    "  content:none!important;",
    "  display:none!important;",
    "  height:0!important;",
    "}",
    "#page-overview .card:last-of-type,#page-overview .gf:last-of-type,",
    "#page-uebersicht .card:last-of-type,#page-uebersicht .gf:last-of-type,",
    "#page-dashboard .card:last-of-type,#page-dashboard .gf:last-of-type{",
    "  margin-bottom:8px!important;",
    "}"
  ].join("\n");
  document.head.appendChild(style);
})();

/* Live-Marktdaten immer cachefrei nachladen. */
(function loadTradeLensMarketModule() {
  var existing = document.querySelector("script[data-tl-market]");
  if (existing && window.TLMarket) {
    if (typeof window.TLMarket.refresh === "function") window.TLMarket.refresh();
    return;
  }
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  var script = document.createElement("script");
  script.src = "tradelens-market.js?v=20260618c&t=" + Date.now();
  script.async = false;
  script.setAttribute("data-tl-market", "true");
  script.onload = function () {
    if (window.TLMarket && typeof window.TLMarket.refresh === "function") {
      window.TLMarket.refresh();
    }
  };
  script.onerror = function () {
    console.error("[TLMarket] tradelens-market.js konnte nicht geladen werden.");
  };
  document.head.appendChild(script);
})();