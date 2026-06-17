/* =====================================================================
   TradeLens AI – Live-Marktdaten auf der Startseite
   ---------------------------------------------------------------------
   - Ruft ausschließlich die Supabase Edge Function "market-data" auf.
   - Der Twelve-Data-Key bleibt serverseitig und erscheint nie im Browser.
   - Verwendet echte XAU/USD-M15-Kerzen für Preis und klassische M15-Pivots.
   - Unterstützt zusätzlich das ältere Serverformat mit fertigen Pivot-Zonen.
   - Bei Fehlern bleiben ehrliche Striche/Statusmeldungen statt Fake-Werten.
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var FUNCTION_SLUG = CFG.MARKET_DATA_FUNCTION || "market-data";
  var ENDPOINT = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") + "/functions/v1/" + FUNCTION_SLUG;
  var CACHE_KEY = "tradelens_market_xauusd_m15_v2";
  var REFRESH_MS = 5 * 60 * 1000;
  var MAX_CACHE_AGE = 15 * 60 * 1000;
  var lastPayload = null;
  var refreshTimer = null;
  var observerTimer = null;
  var started = false;
  var loading = false;

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

  function finiteNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatPrice(value) {
    var n = finiteNumber(value);
    if (n == null) return "—";
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

  function updateHeading(card, interval) {
    if (!card) return;
    var labels = card.querySelectorAll(".label,h2,h3");
    for (var i = 0; i < labels.length; i++) {
      if (norm(labels[i].textContent).indexOf("WICHTIGE ZONEN") >= 0) {
        labels[i].textContent = "WICHTIGE ZONEN – XAUUSD" + (interval ? " · " + interval : "");
        break;
      }
    }
  }

  function classicPivots(high, low, close) {
    high = finiteNumber(high);
    low = finiteNumber(low);
    close = finiteNumber(close);
    if (high == null || low == null || close == null || high <= low) return null;
    var pivot = (high + low + close) / 3;
    return {
      resistance_2: round2(pivot + (high - low)),
      resistance_1: round2(2 * pivot - low),
      pivot: round2(pivot),
      support_1: round2(2 * pivot - high),
      support_2: round2(pivot - (high - low))
    };
  }

  function normalizePayload(payload) {
    if (!payload || payload.ok !== true) return null;

    // Älteres Serverformat: Pivot-Zonen werden bereits von der Function geliefert.
    if (payload.zones && finiteNumber(payload.price) != null) {
      return {
        ok: true,
        price: finiteNumber(payload.price),
        zones: payload.zones,
        interval: payload.interval || "D1",
        quote_datetime: payload.quote_datetime || null,
        basis_datetime: payload.basis_date || null,
        updated_at: payload.updated_at || new Date().toISOString(),
        source: payload.source || "Twelve Data"
      };
    }

    // Aktuell deploytes Format: neueste Kerze + Kerzenliste.
    var latest = payload.latest || null;
    var candles = Array.isArray(payload.candles) ? payload.candles : [];
    var currentPrice = latest ? finiteNumber(latest.close) : null;
    if (currentPrice == null || candles.length < 2) return null;

    // candles[0] kann noch laufen. Die letzte abgeschlossene M15-Kerze ist candles[1].
    var basis = candles[1] || candles[0];
    var zones = classicPivots(basis.high, basis.low, basis.close);
    if (!zones) return null;

    return {
      ok: true,
      price: currentPrice,
      zones: zones,
      interval: payload.interval === "15min" ? "M15" : String(payload.interval || "M15").toUpperCase(),
      quote_datetime: latest.datetime || null,
      basis_datetime: basis.datetime || null,
      updated_at: payload.fetched_at || new Date().toISOString(),
      source: payload.provider === "twelve_data" ? "Twelve Data" : (payload.provider || "Twelve Data")
    };
  }

  function renderPayload(payload, cached) {
    var normalized = normalizePayload(payload);
    if (!normalized) return false;
    var card = findZonesCard();
    if (!card) return false;

    updateHeading(card, normalized.interval);
    setRowValue(card, ["WIDERSTAND 2", "RESISTANCE 2", "R2"], formatPrice(normalized.zones.resistance_2));
    setRowValue(card, ["WIDERSTAND 1", "RESISTANCE 1", "R1"], formatPrice(normalized.zones.resistance_1));
    setRowValue(card, ["AKTUELLER PREIS", "AKTUELL", "CURRENT PRICE"], formatPrice(normalized.price));
    setRowValue(card, ["UNTERSTUTZUNG 1", "SUPPORT 1", "S1"], formatPrice(normalized.zones.support_1));
    setRowValue(card, ["UNTERSTUTZUNG 2", "SUPPORT 2", "S2"], formatPrice(normalized.zones.support_2));

    var status = ensureStatus(card);
    if (status) {
      status.textContent = (cached ? "ZULETZT GELADEN" : "LIVE") + " · XAUUSD " + normalized.interval + " · " + formatTime(normalized.updated_at);
      status.style.color = cached ? "var(--txt-3)" : "var(--green)";
      status.title = "Quelle: " + normalized.source + (normalized.basis_datetime ? " · Pivotbasis: " + normalized.basis_datetime : "");
    }
    return true;
  }

  function renderLoading() {
    var card = findZonesCard();
    if (!card) return;
    updateHeading(card, "M15");
    var status = ensureStatus(card);
    if (status) {
      status.textContent = "Live-Marktdaten werden geladen …";
      status.style.color = "var(--cyan)";
    }
  }

  function renderError(code) {
    var card = findZonesCard();
    if (!card) return;
    updateHeading(card, "M15");
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
        ? "Live-Datenfunktion market-data ist nicht erreichbar"
        : code === "unauthorized"
          ? "Sitzung abgelaufen – bitte erneut anmelden"
          : code === "provider_error" || code === "rate_limited"
            ? "Marktdaten-Limit erreicht – später erneut versuchen"
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
    if (loading) return Promise.resolve(lastPayload);
    if (!ENDPOINT || ENDPOINT.indexOf("https://") !== 0) {
      renderError("not_configured");
      return Promise.resolve(null);
    }

    loading = true;
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
        body: JSON.stringify({
          symbol: "XAU/USD",
          interval: "15min",
          outputsize: 20
        })
      });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || !body || body.ok !== true) {
          var serverCode = body && (body.error || body.error_code);
          var code = response.status === 404 ? "function_not_deployed"
            : response.status === 429 ? "rate_limited"
              : serverCode || "market_error";
          throw new Error(code);
        }
        if (!normalizePayload(body)) throw new Error("market_data_incomplete");
        return body;
      });
    }).then(function (payload) {
      lastPayload = payload;
      writeCache(payload);
      renderPayload(payload, false);
      return payload;
    }).catch(function (error) {
      var code = error && error.message ? error.message : "market_error";
      console.warn("[TLMarket] Live-Daten:", code);
      if (lastPayload) renderPayload(lastPayload, true);
      else renderError(code);
      return null;
    }).then(function (result) {
      loading = false;
      return result;
    }, function () {
      loading = false;
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
      var page = overviewPage();
      if (!document.hidden && (!page || page.classList.contains("active"))) loadLive();
    }, REFRESH_MS);
  }

  function start() {
    if (started) return;
    started = true;

    var cached = readCache();
    if (cached && normalizePayload(cached)) {
      lastPayload = cached;
      renderPayload(cached, true);
    }

    setTimeout(function () {
      installObserver();
      loadLive();
      schedule();
    }, 450);

    document.addEventListener("visibilitychange", function () {
      var page = overviewPage();
      if (!document.hidden && (!page || page.classList.contains("active"))) loadLive();
    });
  }

  window.TLMarket = {
    refresh: loadLive,
    render: function () { return lastPayload ? renderPayload(lastPayload, true) : false; },
    normalize: normalizePayload
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
