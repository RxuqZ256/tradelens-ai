/* =====================================================================
   TradeLens AI – Öffentliche Konfiguration
   ===================================================================== */
window.TRADELENS_CONFIG = {
  APP_MODE: "production",
  SUPABASE_URL: "https://afdletrvfhfmcuhlisqq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_xge0UxBMeTeyvs0NcrGbuw_UzG6LkpY",
  REDIRECT_URL: "https://rxuqz256.github.io/tradelens-ai/index.html",
  LOGIN_FILE: "index.html",
  APP_FILE: "TradeLens_AI_App.html",
  SUPABASE_JS_CDN: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
  ANALYZE_FUNCTION: "smooth-endpoint",
  MARKET_DATA_FUNCTION: "market-data"
};

(function bootTradeLensMarketData() {
  "use strict";

  function injectSpacingFix() {
    var ids = [
      "tradelens-startpage-visibility-fix",
      "tradelens-overview-spacing-fix-v3",
      "tradelens-overview-spacing-fix-v4",
      "tradelens-overview-spacing-fix-v7"
    ];
    for (var i = 0; i < ids.length; i++) {
      var old = document.getElementById(ids[i]);
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }

    var style = document.createElement("style");
    style.id = "tradelens-overview-spacing-fix-v7";
    style.textContent = [
      "#page-overview,#page-uebersicht,#page-dashboard{",
      "padding-bottom:calc(78px + env(safe-area-inset-bottom))!important;",
      "scroll-padding-bottom:calc(78px + env(safe-area-inset-bottom))!important;",
      "}",
      "#page-overview::after,#page-uebersicht::after,#page-dashboard::after{",
      "content:none!important;display:none!important;height:0!important;",
      "}",
      "#page-overview .card:last-of-type,#page-overview .gf:last-of-type,",
      "#page-uebersicht .card:last-of-type,#page-uebersicht .gf:last-of-type,",
      "#page-dashboard .card:last-of-type,#page-dashboard .gf:last-of-type{",
      "margin-bottom:0!important;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function mount() {
    injectSpacingFix();

    if (window.TLMarket && typeof window.TLMarket.refresh === "function") {
      window.TLMarket.refresh();
      return;
    }

    var oldScripts = document.querySelectorAll("script[data-tl-market-bootstrap],script[data-tl-market]");
    for (var i = 0; i < oldScripts.length; i++) {
      if (oldScripts[i].parentNode) oldScripts[i].parentNode.removeChild(oldScripts[i]);
    }

    var script = document.createElement("script");
    script.src = "tradelens-market-v7.js?v=20260618k&t=" + Date.now();
    script.async = true;
    script.setAttribute("data-tl-market-bootstrap", "v7");
    script.onload = function () {
      document.documentElement.setAttribute("data-tl-market-loader", "v7-loaded");
      if (window.TLMarket && typeof window.TLMarket.refresh === "function") {
        window.TLMarket.refresh();
      }
    };
    script.onerror = function () {
      document.documentElement.setAttribute("data-tl-market-loader", "v7-error");
      console.error("[TradeLens] Marktdaten-Modul konnte nicht geladen werden.");
    };
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
