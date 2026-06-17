/* =====================================================================
   TradeLens AI – Live-Marktdaten auf der Übersicht
   ---------------------------------------------------------------------
   Lädt XAU/USD-M15-Kerzen ausschließlich über die Supabase Edge Function
   "market-data". Der Twelve-Data-Key bleibt serverseitig in Supabase.
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var CARD_ID = "tl-live-market-card";
  var STYLE_ID = "tl-live-market-style";
  var FUNCTION_SLUG = CFG.MARKET_DATA_FUNCTION || "market-data";
  var REFRESH_MS = 5 * 60 * 1000;
  var clientInstance = null;
  var refreshTimer = null;
  var busy = false;
  var observer = null;

  function appPathMatches() {
    var current = (window.location.pathname || "").split("/").pop();
    return !current || !CFG.APP_FILE || current === CFG.APP_FILE;
  }

  function isConfigured() {
    return !!(
      CFG.SUPABASE_URL &&
      CFG.SUPABASE_ANON_KEY &&
      /^https:\/\//.test(CFG.SUPABASE_URL)
    );
  }

  function client() {
    if (clientInstance) return clientInstance;
    if (!window.supabase || !window.supabase.createClient || !isConfigured()) return null;
    try {
      clientInstance = window.supabase.createClient(
        CFG.SUPABASE_URL,
        CFG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: "tradelens_auth"
          }
        }
      );
    } catch (error) {
      console.warn("[TLMarketData] Supabase-Client konnte nicht erstellt werden.");
      clientInstance = null;
    }
    return clientInstance;
  }

  function accessToken() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (result) {
      return result && result.data && result.data.session
        ? result.data.session.access_token
        : null;
    }).catch(function () { return null; });
  }

  function functionUrl() {
    return CFG.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/" + FUNCTION_SLUG;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".tl-market-card{margin:10px 0 12px;position:relative;border-radius:19px;padding:1.5px;background:linear-gradient(135deg,#00e5ff,rgba(124,58,237,.9) 62%,rgba(0,229,255,.25));box-shadow:0 0 30px rgba(0,229,255,.2),0 0 38px rgba(124,58,237,.14)}"+
      ".tl-market-card>.tl-market-in{border-radius:17.5px;padding:13px;background:linear-gradient(165deg,rgba(7,13,32,.97),rgba(3,7,18,.99));position:relative;overflow:hidden}"+
      ".tl-market-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}"+
      ".tl-market-kicker{font-family:Saira,sans-serif;text-transform:uppercase;letter-spacing:1.35px;font-size:9.5px;font-weight:600;color:#00e5ff}"+
      ".tl-market-symbol{margin-top:4px;font-family:Saira,sans-serif;font-size:16px;font-weight:700;letter-spacing:.6px;color:#f8fafc}"+
      ".tl-market-symbol span{margin-left:6px;padding:2px 6px;border:1px solid rgba(0,229,255,.25);border-radius:7px;color:#94a3b8;font-size:9px;vertical-align:2px}"+
      ".tl-market-refresh{width:35px;height:35px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(0,229,255,.28);border-radius:11px;background:rgba(7,18,39,.72);color:#00e5ff;cursor:pointer}"+
      ".tl-market-refresh:disabled{opacity:.5;cursor:default}.tl-market-refresh.loading svg{animation:tlMarketSpin .85s linear infinite}"+
      ".tl-market-main{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:12px;align-items:end;margin-top:12px}"+
      ".tl-market-price{font-family:Saira,sans-serif;font-size:31px;line-height:1;font-weight:600;letter-spacing:-1px;color:#fff}"+
      ".tl-market-change{margin-top:7px;font-family:Rajdhani,Saira,sans-serif;font-size:13px;font-weight:700;color:#94a3b8}"+
      ".tl-market-change.up{color:#22c55e}.tl-market-change.down{color:#ff4d6d}"+
      ".tl-market-chart{width:112px;height:54px;display:block;overflow:visible}"+
      ".tl-market-chart .grid{stroke:rgba(148,163,184,.12);stroke-width:1}"+
      ".tl-market-chart .line{fill:none;stroke:#00e5ff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px rgba(0,229,255,.55))}"+
      ".tl-market-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}"+
      ".tl-market-stat{padding:8px 7px;border:1px solid rgba(96,165,250,.13);border-radius:10px;background:rgba(4,10,25,.5)}"+
      ".tl-market-stat small{display:block;color:#52607a;font:600 8px Saira,sans-serif;letter-spacing:.7px;text-transform:uppercase}"+
      ".tl-market-stat strong{display:block;margin-top:3px;color:#dbeafe;font:600 11.5px Saira,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
      ".tl-market-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:#52607a;font:500 10px Rajdhani,Saira,sans-serif}"+
      ".tl-market-live{display:inline-flex;align-items:center;gap:5px;color:#94a3b8}.tl-market-live i{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.8)}"+
      ".tl-market-error{display:none;margin-top:10px;padding:9px 10px;border:1px solid rgba(255,77,109,.3);border-radius:10px;background:rgba(74,15,29,.25);color:#fda4af;font:600 11px/1.4 Rajdhani,Saira,sans-serif}"+
      ".tl-market-error.on{display:block}"+
      "@keyframes tlMarketSpin{to{transform:rotate(360deg)}}"+
      "@media(max-width:350px){.tl-market-main{grid-template-columns:1fr 94px}.tl-market-chart{width:94px}.tl-market-price{font-size:27px}}";
    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findOverviewPage() {
    var briefing = document.querySelector(".briefing");
    if (briefing) return briefing.closest(".page") || briefing.parentElement;

    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) {
      var text = normalizeText(pages[i].textContent);
      if (
        text.indexOf("markt") >= 0 &&
        (text.indexOf("mover") >= 0 || text.indexOf("übersicht") >= 0 || text.indexOf("briefing") >= 0)
      ) return pages[i];
    }
    return null;
  }

  function createCard() {
    var card = document.createElement("div");
    card.id = CARD_ID;
    card.className = "tl-market-card";
    card.setAttribute("aria-live", "polite");
    card.innerHTML =
      '<div class="tl-market-in">'+
        '<div class="tl-market-head">'+
          '<div><div class="tl-market-kicker">Live Marktdaten</div><div class="tl-market-symbol">XAU/USD <span>M15</span></div></div>'+
          '<button type="button" class="tl-market-refresh" id="tl-market-refresh" aria-label="Marktdaten aktualisieren">'+
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>'+
          '</button>'+
        '</div>'+
        '<div class="tl-market-main">'+
          '<div><div class="tl-market-price" id="tl-market-price">—</div><div class="tl-market-change" id="tl-market-change">Daten werden geladen …</div></div>'+
          '<svg class="tl-market-chart" id="tl-market-chart" viewBox="0 0 112 54" preserveAspectRatio="none" aria-label="XAU/USD Kursverlauf">'+
            '<path class="grid" d="M0 13.5H112M0 27H112M0 40.5H112"/><path class="line" id="tl-market-line" d=""/>'+
          '</svg>'+
        '</div>'+
        '<div class="tl-market-stats">'+
          '<div class="tl-market-stat"><small>M15 Hoch</small><strong id="tl-market-high">—</strong></div>'+
          '<div class="tl-market-stat"><small>M15 Tief</small><strong id="tl-market-low">—</strong></div>'+
          '<div class="tl-market-stat"><small>Volumen</small><strong id="tl-market-volume">—</strong></div>'+
        '</div>'+
        '<div class="tl-market-error" id="tl-market-error"></div>'+
        '<div class="tl-market-foot"><span class="tl-market-live"><i></i>Twelve Data</span><span id="tl-market-updated">Noch nicht aktualisiert</span></div>'+
      '</div>';

    var refresh = card.querySelector("#tl-market-refresh");
    if (refresh) refresh.addEventListener("click", function () { loadMarketData(true); });
    return card;
  }

  function ensureCard() {
    var existing = document.getElementById(CARD_ID);
    if (existing) return existing;

    var page = findOverviewPage();
    if (!page) return null;

    injectStyles();
    var card = createCard();
    var briefing = page.querySelector(".briefing");
    var anchor = briefing ? (briefing.closest(".gf, .card") || briefing) : null;

    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
    else {
      var appbar = page.querySelector(".appbar");
      if (appbar && appbar.parentNode) appbar.parentNode.insertBefore(card, appbar.nextSibling);
      else page.insertBefore(card, page.firstChild);
    }
    return card;
  }

  function number(value, digits) {
    var n = Number(value);
    if (!isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(n);
    } catch (_error) {
      return n.toFixed(digits);
    }
  }

  function localTime(iso) {
    if (!iso) return "Zeit unbekannt";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "Zeit unbekannt";
    try {
      return "Aktualisiert " + new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date) + " Uhr";
    } catch (_error) {
      return "Aktualisiert";
    }
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setBusy(value) {
    busy = value;
    var button = document.getElementById("tl-market-refresh");
    if (button) {
      button.disabled = value;
      button.classList.toggle("loading", value);
    }
  }

  function showError(message) {
    var node = document.getElementById("tl-market-error");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("on", !!message);
  }

  function sparkPath(candles) {
    var closes = [];
    for (var i = candles.length - 1; i >= 0; i--) {
      var value = Number(candles[i] && candles[i].close);
      if (isFinite(value)) closes.push(value);
    }
    if (closes.length < 2) return "";

    var min = Math.min.apply(Math, closes);
    var max = Math.max.apply(Math, closes);
    var span = max - min || 1;
    var width = 112;
    var height = 54;
    var pad = 4;
    var parts = [];

    for (var j = 0; j < closes.length; j++) {
      var x = pad + (j * (width - pad * 2)) / (closes.length - 1);
      var y = height - pad - ((closes[j] - min) / span) * (height - pad * 2);
      parts.push((j === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1));
    }
    return parts.join(" ");
  }

  function render(data) {
    var latest = data && data.latest ? data.latest : null;
    var candles = data && Array.isArray(data.candles) ? data.candles : [];
    if (!latest || !isFinite(Number(latest.close))) throw new Error("invalid_market_payload");

    setText("tl-market-price", number(latest.close, 2));
    setText("tl-market-high", number(latest.high, 2));
    setText("tl-market-low", number(latest.low, 2));
    setText("tl-market-volume", latest.volume == null ? "—" : number(latest.volume, 0));
    setText("tl-market-updated", localTime(data.fetched_at));

    var previous = candles.length > 1 ? Number(candles[1].close) : NaN;
    var current = Number(latest.close);
    var change = isFinite(previous) && previous !== 0 ? current - previous : NaN;
    var percent = isFinite(change) ? (change / previous) * 100 : NaN;
    var changeNode = document.getElementById("tl-market-change");
    if (changeNode) {
      changeNode.className = "tl-market-change";
      if (isFinite(change) && isFinite(percent)) {
        var up = change >= 0;
        changeNode.classList.add(up ? "up" : "down");
        changeNode.textContent = (up ? "+" : "") + number(change, 2) + " · " + (up ? "+" : "") + number(percent, 2) + " % zur vorherigen M15-Kerze";
      } else {
        changeNode.textContent = "M15-Marktdaten verfügbar";
      }
    }

    var line = document.getElementById("tl-market-line");
    if (line) line.setAttribute("d", sparkPath(candles.slice(0, 20)));
    showError("");
  }

  function friendlyError(code, status) {
    if (code === "unauthorized" || status === 401 || status === 403) return "Sitzung abgelaufen. Bitte melde dich erneut an.";
    if (status === 429 || code === "provider_error") return "Das Marktdaten-Limit ist gerade erreicht. Bitte später erneut versuchen.";
    if (code === "secret_missing") return "Der Twelve-Data-Zugang ist serverseitig nicht eingerichtet.";
    if (status === 404) return "Die Edge Function market-data ist nicht erreichbar.";
    return "Echte Marktdaten konnten gerade nicht geladen werden.";
  }

  function loadMarketData(force) {
    if (busy && !force) return Promise.resolve(false);
    var card = ensureCard();
    if (!card) return Promise.resolve(false);
    if (!isConfigured()) {
      showError("Supabase ist noch nicht vollständig konfiguriert.");
      return Promise.resolve(false);
    }

    setBusy(true);
    showError("");
    return accessToken().then(function (token) {
      if (!token) throw { code: "unauthorized", status: 401 };
      return fetch(functionUrl(), {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "apikey": CFG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol: "XAU/USD",
          interval: "15min",
          outputsize: 20
        })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok || !payload || payload.ok !== true) {
            throw {
              code: payload && (payload.error || payload.error_code),
              status: response.status
            };
          }
          render(payload);
          return true;
        });
      });
    }).catch(function (error) {
      var code = error && error.code;
      var status = error && error.status;
      showError(friendlyError(code, status));
      var change = document.getElementById("tl-market-change");
      if (change && change.textContent === "Daten werden geladen …") change.textContent = "Keine Live-Daten verfügbar";
      return false;
    }).then(function (result) {
      setBusy(false);
      return result;
    }, function () {
      setBusy(false);
      return false;
    });
  }

  function isOverviewVisible() {
    var card = document.getElementById(CARD_ID);
    if (!card) return false;
    var page = card.closest(".page");
    return !page || page.classList.contains("active");
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!document.hidden && isOverviewVisible()) loadMarketData(false);
    }, REFRESH_MS);
  }

  function boot() {
    if (!appPathMatches()) return;
    var card = ensureCard();
    if (card) {
      loadMarketData(false);
      scheduleRefresh();
      if (observer) observer.disconnect();
      observer = null;
      return;
    }

    if (!observer && document.documentElement) {
      observer = new MutationObserver(function () {
        if (ensureCard()) boot();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && isOverviewVisible()) loadMarketData(false);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.TLMarketData = {
    refresh: function () { return loadMarketData(true); },
    ensureCard: ensureCard
  };
})();
