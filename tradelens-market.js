/* =====================================================================
   TradeLens AI – Live-Marktdaten auf der Startseite
   ---------------------------------------------------------------------
   - Ruft ausschliesslich die Supabase Edge Function "market-data" auf.
   - Der Twelve-Data-Key bleibt serverseitig und erscheint nie im Browser.
   - Zeigt XAUUSD-Livepreis sowie R1/R2/S1/S2 aus klassischen Tages-Pivots.
   - Bei Fehlern bleiben ehrliche Striche/Statusmeldungen statt Fake-Werten.
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var ENDPOINT = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") + "/functions/v1/market-data";
  var CACHE_KEY = "tradelens_market_xauusd_v1";
  var REFRESH_MS = 60000;
  var MAX_CACHE_AGE = 10 * 60 * 1000;
  var lastPayload = null;
  var refreshTimer = null;
  var observerTimer = null;
  var started = false;

  function norm(value) {
    return String(value || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function overviewPage() {
    return document.getElementById("page-overview") || document.getElementById("page-uebersicht");
  }

  function findZonesCard() {
    var page = overviewPage();
    if (!page) return null;
    var cards = page.querySelectorAll(".gf,.card");
    for (var i = 0; i < cards.length; i++) {
      if (norm(cards[i].textContent).indexOf("WICHTIGE ZONEN") >= 0) return cards[i];
    }
    return null;
  }

  function findRow(card, labels) {
    if (!card) return null;
    var rows = card.querySelectorAll(".zr,.set-row,.row");
    for (var i = 0; i < rows.length; i++) {
      var labelEl = rows[i].querySelector(".lbl,.name,.label");
      var text = norm(labelEl ? labelEl.textContent : rows[i].textContent);
      for (var j = 0; j < labels.length; j++) {
        if (text === labels[j] || text.indexOf(labels[j]) >= 0) return rows[i];
      }
    }
    return null;
  }

  function setRowValue(card, labels, value) {
    var row = findRow(card, labels);
    if (!row) return false;
    var target = row.querySelector(".val,.set-val,.pct");
    if (!target) {
      var spans = row.querySelectorAll("span,div");
      target = spans.length ? spans[spans.length - 1] : null;
    }
    if (!target) return false;
    target.textContent = value;
    return true;
  }

  function formatPrice(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(n);
    } catch (_e) {
      return n.toFixed(2).replace(".", ",");
    }
  }

  function formatTime(iso) {
    var d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) d = new Date();
    try {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return "";
    }
  }

  function ensureStatus(card) {
    if (!card) return null;
    var status = card.querySelector("[data-tl-market-status]");
    if (status) return status;
    status = document.createElement("div");
    status.setAttribute("data-tl-market-status", "true");
    status.style.cssText = "margin-top:10px;text-align:center;font-family:var(--f-body);font-size:10.5px;color:var(--txt-3);letter-spacing:.2px";
    var host = card.querySelector(".in") || card;
    host.appendChild(status);
    return status;
  }

  function updateHeading(card) {
    if (!card) return;
    var labels = card.querySelectorAll(".label,h2,h3");
    for (var i = 0; i < labels.length; i++) {
      if (norm(labels[i].textContent).indexOf("WICHTIGE ZONEN") >= 0) {
        labels[i].textContent = "WICHTIGE ZONEN – XAUUSD";
        break;
      }
    }
  }

  function renderPayload(payload, cached) {
    if (!payload || !payload.ok || !payload.zones) return false;
    var card = findZonesCard();
    if (!card) return false;

    updateHeading(card);
    setRowValue(card, ["WIDERSTAND 2", "RESISTANCE 2", "R2"], formatPrice(payload.zones.resistance_2));
    setRowValue(card, ["WIDERSTAND 1", "RESISTANCE 1", "R1"], formatPrice(payload.zones.resistance_1));
    setRowValue(card, ["AKTUELLER PREIS", "AKTUELL", "CURRENT PRICE"], formatPrice(payload.price));
    setRowValue(card, ["UNTERSTUTZUNG 1", "SUPPORT 1", "S1"], formatPrice(payload.zones.support_1));
    setRowValue(card, ["UNTERSTUTZUNG 2", "SUPPORT 2", "S2"], formatPrice(payload.zones.support_2));

    var status = ensureStatus(card);
    if (status) {
      status.textContent = (cached ? "Zuletzt geladen" : "LIVE") + " · XAUUSD · " + formatTime(payload.updated_at);
      status.style.color = cached ? "var(--txt-3)" : "var(--green)";
    }
    return true;
  }

  function renderLoading() {
    var card = findZonesCard();
    if (!card) return;
    updateHeading(card);
    var status = ensureStatus(card);
    if (status) {
      status.textContent = "Live-Marktdaten werden geladen …";
      status.style.color = "var(--cyan)";
    }
  }

  function renderError(code) {
    var card = findZonesCard();
    if (!card) return;
    updateHeading(card);
    if (!lastPayload) {
      setRowValue(card, ["WIDERSTAND 2", "RESISTANCE 2", "R2"], "—");
      setRowValue(card, ["WIDERSTAND 1", "RESISTANCE 1", "R1"], "—");
      setRowValue(card, ["AKTUELLER PREIS", "AKTUELL", "CURRENT PRICE"], "—");
      setRowValue(card, ["UNTERSTUTZUNG 1", "SUPPORT 1", "S1"], "—");
      setRowValue(card, ["UNTERSTUTZUNG 2", "SUPPORT 2", "S2"], "—");
    }
    var status = ensureStatus(card);
    if (status) {
      var text = code === "function_not_deployed"
        ? "Live-Datenfunktion muss noch veröffentlicht werden"
        : "Live-Marktdaten aktuell nicht verfügbar";
      status.textContent = text;
      status.style.color = "var(--red)";
    }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var item = JSON.parse(raw);
      if (!item || !item.saved_at || Date.now() - item.saved_at > MAX_CACHE_AGE) return null;
      return item.payload || null;
    } catch (_e) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ saved_at: Date.now(), payload: payload }));
    } catch (_e) { /* Cache optional */ }
  }

  function getToken() {
    if (!window.TLAuth || typeof window.TLAuth.getSession !== "function") {
      return Promise.resolve(null);
    }
    return window.TLAuth.getSession().then(function (res) {
      return res && res.session && res.session.access_token ? res.session.access_token : null;
    }).catch(function () { return null; });
  }

  function loadLive() {
    if (!ENDPOINT || ENDPOINT.indexOf("https://") !== 0) {
      renderError("not_configured");
      return Promise.resolve(null);
    }
    renderLoading();
    return getToken().then(function (token) {
      if (!token) throw new Error("unauthorized");
      return fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "apikey": CFG.SUPABASE_ANON_KEY || "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: "XAU/USD" })
      });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || !body || !body.ok) {
          var code = response.status === 404 ? "function_not_deployed" : (body.error_code || "market_error");
          throw new Error(code);
        }
        return body;
      });
    }).then(function (payload) {
      lastPayload = payload;
      writeCache(payload);
      renderPayload(payload, false);
      return payload;
    }).catch(function (error) {
      console.warn("[TLMarket] Live-Daten:", error && error.message ? error.message : "market_error");
      if (lastPayload) renderPayload(lastPayload, true);
      else renderError(error && error.message ? error.message : "market_error");
      return null;
    });
  }

  function installObserver() {
    var page = overviewPage();
    if (!page || !window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      if (!lastPayload) return;
      clearTimeout(observerTimer);
      observerTimer = setTimeout(function () { renderPayload(lastPayload, true); }, 120);
    });
    observer.observe(page, { childList: true, subtree: true, characterData: true });
  }

  function schedule() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!document.hidden) loadLive();
    }, REFRESH_MS);
  }

  function start() {
    if (started) return;
    started = true;

    var cached = readCache();
    if (cached) {
      lastPayload = cached;
      renderPayload(cached, true);
    }

    setTimeout(function () {
      installObserver();
      loadLive();
      schedule();
    }, 450);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadLive();
    });
  }

  window.TLMarket = {
    refresh: loadLive,
    render: function () { return lastPayload ? renderPayload(lastPayload, true) : false; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
