/* =====================================================================
   TradeLens AI – Öffentliche Konfiguration
   ---------------------------------------------------------------------
   WICHTIG:
   - Hier gehören NUR ÖFFENTLICHE Werte hinein (Anon-Key ist öffentlich).
   - NIEMALS den geheimen Service-Role-Key hier eintragen.
   - Diese Datei wird vom Browser geladen und ist für jeden sichtbar.
   ===================================================================== */
window.TRADELENS_CONFIG = {

  /* -------------------------------------------------------------------
     APP_MODE steuert den Auth-Guard – UNABHÄNGIG von den Keys.
       "preview"     -> keine Auth-Sperre. Login & App lassen sich lokal
                        als Designvorschau öffnen (kein Supabase nötig).
       "production"  -> Auth-Guard ist zwingend aktiv. Ohne gültige
                        Session wird zum Login weitergeleitet.
     ------------------------------------------------------------------- */
  APP_MODE: "production",

  /* -------------------------------------------------------------------
     Supabase-Zugang (Dashboard -> Project Settings -> API).
     Solange hier die Platzhalter stehen, ist keine echte Auth möglich.
     ------------------------------------------------------------------- */
  SUPABASE_URL:      "https://afdletrvfhfmcuhlisqq.supabase.co",      // z. B. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_xge0UxBMeTeyvs0NcrGbuw_UzG6LkpY",  // öffentlicher publishable/anon key

  /* -------------------------------------------------------------------
     Ziel-URL für Bestätigungs- und Recovery-Mails.
     Diese URL MUSS in Supabase unter
       Authentication -> URL Configuration -> Redirect URLs
     als erlaubte Redirect-URL hinterlegt sein.
     Lokaler Test (siehe README_AUTH_SETUP.md):
       http://localhost:5173/TradeLens_AI_Login.html
     ------------------------------------------------------------------- */
  REDIRECT_URL: "https://rxuqz256.github.io/tradelens-ai/index.html",

  /* -------------------------------------------------------------------
     Relative Dateinamen für die Weiterleitungen zwischen Login und App.
     Relativ gehalten, damit es lokal (localhost) wie gehostet funktioniert.
     ------------------------------------------------------------------- */
  LOGIN_FILE: "index.html",
  APP_FILE:   "TradeLens_AI_App.html",

  /* -------------------------------------------------------------------
     Supabase-JS-Bibliothek (UMD-Build) vom CDN.
     Bei Bedarf auf eine self-gehostete Kopie umstellbar.
     ------------------------------------------------------------------- */
  SUPABASE_JS_CDN: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",

  /* -------------------------------------------------------------------
     Slug der deployten Supabase Edge Function für die Chartanalyse.
     Aktuell in Supabase veröffentlicht als "smooth-endpoint"
     (Quellcode im Repo: supabase/functions/analyze-chart).
     ------------------------------------------------------------------- */
  ANALYZE_FUNCTION: "smooth-endpoint",

  /* -------------------------------------------------------------------
     Slug der Edge Function für echte Marktdaten über Twelve Data.
     Der geheime TWELVE_DATA_API_KEY bleibt ausschließlich in Supabase.
     ------------------------------------------------------------------- */
  MARKET_DATA_FUNCTION: "market-data"
};

/* =====================================================================
   App-Bootstrap für Live-Marktdaten
   ---------------------------------------------------------------------
   Diese Konfigurationsdatei wird garantiert von Login und App geladen.
   Deshalb starten wir das Marktdaten-Modul hier direkt für die App-Seite,
   statt uns auf eine optionale spätere Datei zu verlassen.
   ===================================================================== */
(function bootTradeLensMarketData() {
  "use strict";

  var cfg = window.TRADELENS_CONFIG || {};
  var file = (window.location.pathname || "").split("/").pop();
  if (file !== (cfg.APP_FILE || "TradeLens_AI_App.html")) return;

  function mount() {
    var styleId = "tradelens-overview-spacing-fix-v3";
    if (!document.getElementById(styleId)) {
      var style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "#page-overview,#page-uebersicht,#page-dashboard{",
        "  padding-bottom:calc(82px + env(safe-area-inset-bottom))!important;",
        "  scroll-padding-bottom:calc(82px + env(safe-area-inset-bottom))!important;",
        "}",
        "#page-overview::after,#page-uebersicht::after,#page-dashboard::after{",
        "  content:none!important;display:none!important;height:0!important;",
        "}",
        "#page-overview .card:last-of-type,#page-overview .gf:last-of-type,",
        "#page-uebersicht .card:last-of-type,#page-uebersicht .gf:last-of-type,",
        "#page-dashboard .card:last-of-type,#page-dashboard .gf:last-of-type{",
        "  margin-bottom:0!important;",
        "}"
      ].join("\n");
      document.head.appendChild(style);
    }

    if (window.TLMarket && typeof window.TLMarket.refresh === "function") {
      window.TLMarket.refresh();
      return;
    }

    var existing = document.querySelector("script[data-tl-market-bootstrap]");
    if (existing) return;

    var script = document.createElement("script");
    script.src = "tradelens-market.js?v=20260618e&t=" + Date.now();
    script.async = true;
    script.setAttribute("data-tl-market-bootstrap", "true");
    script.onload = function () {
      if (window.TLMarket && typeof window.TLMarket.refresh === "function") {
        window.TLMarket.refresh();
      }
    };
    script.onerror = function () {
      console.error("[TradeLens] tradelens-market.js konnte nicht geladen werden.");
    };
    document.head.appendChild(script);
  }

  if (document.readyState === "complete") mount();
  else window.addEventListener("load", mount, { once: true });
})();
