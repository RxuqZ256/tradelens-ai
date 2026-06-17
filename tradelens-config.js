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

/* Live-Marktdaten-Modul nur innerhalb der eigentlichen App nachladen.
   Das Modul wartet selbstständig, bis DOM und Supabase verfügbar sind. */
(function () {
  "use strict";
  var cfg = window.TRADELENS_CONFIG || {};
  var current = (window.location.pathname || "").split("/").pop();
  if (current && cfg.APP_FILE && current !== cfg.APP_FILE) return;
  if (document.querySelector("script[data-tl-market-data]")) return;
  var script = document.createElement("script");
  script.src = "tradelens-market-data.js?v=20260617a";
  script.async = false;
  script.setAttribute("data-tl-market-data", "true");
  document.head.appendChild(script);
})();
