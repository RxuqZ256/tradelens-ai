/* =====================================================================
   TradeLens AI – Live-Marktdaten für Übersicht, Top Movers und Zonen
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var FUNCTION_SLUG = CFG.MARKET_DATA_FUNCTION || "market-data";
  var ENDPOINT = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") +
    "/functions/v1/" + FUNCTION_SLUG;

  var CACHE_KEY = "tradelens_market_overview_v5";
  var REFRESH_MS = 15 * 60 * 1000;
  var MAX_CACHE_AGE = 30 * 60 * 1000;
  var MIN_FETCH_GAP = 60 * 1000;
  var REQUEST_GAP = 1400;

  var clientInstance = null;
  var busy = false;
  var refreshTimer = null;
  var lastFetchAt = 0;
  var state = {
    payloads: {},
    sources: {},
    savedAt: 0
  };

  var MOVER_DEFS = [
    { label: "XAUUSD", symbols: ["XAU/USD"], outputsize: 20 },
    { label: "EURUSD", symbols: ["EUR/USD"], outputsize: 3 },
    { label: "BTCUSD", symbols: ["BTC/USD"], outputsize: 3 },
    { label: "NAS100", symbols: ["NDX", "QQQ", "IXIC"], outputsize: 3 }
  ];

  document.documentElement.setAttribute("data-tl-market-script", "v5");

  function norm(value) {
    var text = String(value || "").toUpperCase();
    try {
      text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function delay(milliseconds) {
    return new Promise(function (resolve) {
      setTimeout(resolve, milliseconds);
    });
  }

  function overviewRoot() {
    return document.getElementById("page-overview") ||
      document.getElementById("page-uebersicht") ||
      document.getElementById("page-dashboard") ||
      document;
  }

  function closestCard(element) {
    if (!element) return null;
    if (typeof element.closest === "function") {
      var direct = element.closest(".gf,.card");
      if (direct) return direct;
    }
    var node = element;
    while (node && node !== document.body) {
      if (node.classList && (node.classList.contains("gf") || node.classList.contains("card"))) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findMoverRow(label) {
    var rows = overviewRoot().querySelectorAll(".mover");
    for (var i = 0; i < rows.length; i++) {
      var symbol = rows[i].querySelector(".sym");
      if (symbol && norm(symbol.textContent) === label) return rows[i];
    }
    return null;
  }

  function findZoneRow(label) {
    var rows = overviewRoot().querySelectorAll(".zr");
    for (var i = 0; i < rows.length; i++) {
      var rowLabel = rows[i].querySelector(".lbl");
      if (rowLabel && norm(rowLabel.textContent) === label) return rows[i];
    }
    return null;
  }

  function findMoverCard() {
    return closestCard(findMoverRow("XAUUSD"));
  }

  function findZoneCard() {
    return closestCard(findZoneRow("AKTUELLER PREIS"));
  }

  function setMoverValue(label, value, stateClass, sourceSymbol) {
    var row = findMoverRow(label);
    if (!row) return false;
    var target = row.querySelector(".pct");
    if (!target) return false;

    target.textContent = value;
    target.classList.remove("pos", "neg");
    if (stateClass) target.classList.add(stateClass);
    if (sourceSymbol) row.title = "Quelle: " + sourceSymbol;
    return true;
  }

  function setZoneValue(label, value) {
    var row = findZoneRow(label);
    if (!row) return false;
    var target = row.querySelector(".val");
    if (!target) return false;
    target.textContent = value;
    return true;
  }

  function setZoneHeading() {
    var card = findZoneCard();
    if (!card) return;
    var labels = card.querySelectorAll(".label,h2,h3");
    for (var i = 0; i < labels.length; i++) {
      if (norm(labels[i].textContent).indexOf("WICHTIGE ZONEN") >= 0) {
        labels[i].textContent = "WICHTIGE ZONEN – XAUUSD · M15";
        return;
      }
    }
  }

  function ensureZoneStatus() {
    var card = findZoneCard();
    if (!card) return null;
    var status = card.querySelector("[data-tl-zone-status]");
    if (status) return status;

    status = document.createElement("div");
    status.setAttribute("data-tl-zone-status", "true");
    status.style.cssText =
      "margin-top:8px;padding-top:7px;border-top:1px solid rgba(96,165,250,.12);" +
      "text-align:center;font-family:var(--f-body);font-size:10px;" +
      "color:var(--txt-3);letter-spacing:.2px";
    var host = card.querySelector(".in") || card;
    host.appendChild(status);
    return status;
  }

  function moverFooter() {
    var card = findMoverCard();
    if (!card) return null;

    var duplicates = card.querySelectorAll("[data-tl-mover-status]");
    for (var i = 0; i < duplicates.length; i++) {
      if (duplicates[i].parentNode) duplicates[i].parentNode.removeChild(duplicates[i]);
    }

    var candidates = card.querySelectorAll(".sub,small,p,div");
    for (var j = candidates.length - 1; j >= 0; j--) {
      var text = norm(candidates[j].textContent);
      if (
        text.indexOf("KEINE SIMULIERTEN") >= 0 ||
        text.indexOf("TWELVE DATA") >= 0 ||
        text.indexOf("MARKTDATEN WERDEN") >= 0 ||
        text.indexOf("ZULETZT GELADEN") >= 0
      ) {
        candidates[j].setAttribute("data-tl-mover-footer", "true");
        return candidates[j];
      }
    }

    var footer = document.createElement("div");
    footer.setAttribute("data-tl-mover-footer", "true");
    footer.style.cssText =
      "margin-top:8px;padding-top:7px;border-top:1px solid rgba(96,165,250,.12);" +
      "text-align:center;font-family:var(--f-body);font-size:10px;" +
      "color:var(--txt-3);letter-spacing:.2px";
    var host = card.querySelector(".in") || card;
    host.appendChild(footer);
    return footer;
  }

  function setZoneStatus(text, color) {
    setZoneHeading();
    var status = ensureZoneStatus();
    if (!status) return;
    status.textContent = text;
    status.style.color = color || "var(--txt-3)";
  }

  function setMoverStatus(text, color) {
    var footer = moverFooter();
    if (!footer) return;
    footer.textContent = text;
    footer.style.color = color || "var(--txt-3)";
  }

  function formatPrice(value) {
    var number = finite(value);
    if (number == null) return "—";
    try {
      return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(number);
    } catch (_error) {
      return number.toFixed(2).replace(".", ",");
    }
  }

  function formatPercent(value) {
    var number = finite(value);
    if (number == null) return "—";
    return (number > 0 ? "+" : "") + number.toFixed(2).replace(".", ",") + "%";
  }

  function formatTime(value) {
    var date = new Date(value || Date.now());
    if (isNaN(date.getTime())) date = new Date();
    try {
      return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch (_error) {
      return "";
    }
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function calculatePivots(candle) {
    if (!candle) return null;
    var high = finite(candle.high);
    var low = finite(candle.low);
    var close = finite(candle.close);
    if (high == null || low == null || close == null || high <= low) return null;

    var pivot = (high + low + close) / 3;
    return {
      resistance2: round2(pivot + (high - low)),
      resistance1: round2(2 * pivot - low),
      support1: round2(2 * pivot - high),
      support2: round2(pivot - (high - low))
    };
  }

  function moverFromPayload(payload) {
    if (!payload || payload.ok !== true) return null;
    var candles = Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload.latest || candles[0] || null;
    var previous = candles[1] || null;
    var currentClose = latest ? finite(latest.close) : null;
    var previousClose = previous ? finite(previous.close) : null;

    if (currentClose == null || previousClose == null || previousClose === 0) return null;
    return {
      price: currentClose,
      changePercent: ((currentClose - previousClose) / previousClose) * 100,
      updatedAt: payload.fetched_at || new Date().toISOString()
    };
  }

  function renderXau(payload, cached) {
    if (!payload || payload.ok !== true) return false;
    var candles = Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload.latest || candles[0] || null;
    var basis = candles[1] || candles[0] || null;
    var price = latest ? finite(latest.close) : null;
    var pivots = calculatePivots(basis);
    var mover = moverFromPayload(payload);

    if (price != null && pivots) {
      setZoneHeading();
      setZoneValue("WIDERSTAND 2", formatPrice(pivots.resistance2));
      setZoneValue("WIDERSTAND 1", formatPrice(pivots.resistance1));
      setZoneValue("AKTUELLER PREIS", formatPrice(price));
      setZoneValue("UNTERSTUTZUNG 1", formatPrice(pivots.support1));
      setZoneValue("UNTERSTUTZUNG 2", formatPrice(pivots.support2));
      setZoneStatus(
        (cached ? "ZULETZT GELADEN" : "LIVE") + " · TWELVE DATA · " +
          formatTime(payload.fetched_at),
        cached ? "var(--txt-3)" : "var(--green)"
      );
    }

    if (mover) {
      setMoverValue(
        "XAUUSD",
        formatPercent(mover.changePercent),
        mover.changePercent >= 0 ? "pos" : "neg",
        "XAU/USD"
      );
    }
    return price != null || !!mover;
  }

  function renderMover(label, payload, sourceSymbol) {
    var mover = moverFromPayload(payload);
    if (!mover) return false;
    return setMoverValue(
      label,
      formatPercent(mover.changePercent),
      mover.changePercent >= 0 ? "pos" : "neg",
      sourceSymbol
    );
  }

  function renderState(cached) {
    var rendered = 0;
    if (state.payloads.XAUUSD && renderXau(state.payloads.XAUUSD, cached)) rendered++;
    if (state.payloads.EURUSD && renderMover("EURUSD", state.payloads.EURUSD, state.sources.EURUSD)) rendered++;
    if (state.payloads.BTCUSD && renderMover("BTCUSD", state.payloads.BTCUSD, state.sources.BTCUSD)) rendered++;
    if (state.payloads.NAS100 && renderMover("NAS100", state.payloads.NAS100, state.sources.NAS100)) rendered++;

    setMoverStatus(
      rendered === 4
        ? ((cached ? "ZULETZT GELADEN" : "LIVE") + " · M15 · TWELVE DATA")
        : (rendered > 0 ? "TEILWEISE GELADEN · M15 · TWELVE DATA" : "KEINE LIVE-KURSE VERFÜGBAR"),
      rendered === 4 ? (cached ? "var(--txt-3)" : "var(--green)") :
        (rendered > 0 ? "var(--gold)" : "var(--red)")
    );
    return rendered;
  }

  function readCache() {
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !cached.savedAt || Date.now() - cached.savedAt > MAX_CACHE_AGE) return null;
      return cached;
    } catch (_error) {
      return null;
    }
  }

  function writeCache() {
    state.savedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch (_error) {}
  }

  function directClient() {
    if (clientInstance) return clientInstance;
    if (!window.supabase || !window.supabase.createClient ||
        !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return null;

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
    } catch (_error) {
      clientInstance = null;
    }
    return clientInstance;
  }

  function getToken() {
    if (window.TLAuth && typeof window.TLAuth.getSession === "function") {
      return window.TLAuth.getSession().then(function (result) {
        return result && result.session ? result.session.access_token : null;
      }).catch(function () { return null; });
    }

    var client = directClient();
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (result) {
      return result && result.data && result.data.session
        ? result.data.session.access_token
        : null;
    }).catch(function () { return null; });
  }

  function invokeMarket(symbol, outputsize, accessToken, retryCount) {
    retryCount = retryCount || 0;
    return fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "apikey": CFG.SUPABASE_ANON_KEY || "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        symbol: symbol,
        interval: "15min",
        outputsize: outputsize
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || !body || body.ok !== true) {
          var failure = {
            code: body && (body.error || body.error_code),
            status: response.status
          };
          if (response.status === 429 && retryCount < 1) {
            return delay(5000).then(function () {
              return invokeMarket(symbol, outputsize, accessToken, retryCount + 1);
            });
          }
          throw failure;
        }
        return body;
      });
    });
  }

  function loadDefinition(definition, accessToken) {
    var index = 0;

    function attempt() {
      var symbol = definition.symbols[index++];
      return invokeMarket(symbol, definition.outputsize, accessToken, 0)
        .then(function (payload) {
          if (!moverFromPayload(payload)) {
            throw { code: "market_data_incomplete", status: 502 };
          }
          return { payload: payload, symbol: symbol };
        })
        .catch(function (error) {
          if (index < definition.symbols.length) {
            return delay(REQUEST_GAP).then(attempt);
          }
          throw error;
        });
    }

    return attempt();
  }

  function saveAndRender(label, result, cached) {
    if (!result || !result.payload) return false;
    state.payloads[label] = result.payload;
    state.sources[label] = result.symbol;
    writeCache();

    if (label === "XAUUSD") return renderXau(result.payload, cached);
    return renderMover(label, result.payload, result.symbol);
  }

  function errorMessage(error) {
    var code = error && error.code;
    var status = error && error.status;
    if (code === "unauthorized" || status === 401 || status === 403) {
      return "SITZUNG ABGELAUFEN – BITTE NEU ANMELDEN";
    }
    if (status === 429 || code === "provider_error") {
      return "MARKTDATEN-LIMIT – NÄCHSTER VERSUCH SPÄTER";
    }
    if (code === "secret_missing") return "TWELVE-DATA-ZUGANG FEHLT";
    if (status === 404) return "EDGE FUNCTION MARKET-DATA NICHT GEFUNDEN";
    return "EINIGE LIVE-KURSE SIND NICHT VERFÜGBAR";
  }

  function load() {
    if (busy) return Promise.resolve(state);
    if (!findMoverCard() && !findZoneCard()) return Promise.resolve(null);

    if (lastFetchAt && Date.now() - lastFetchAt < MIN_FETCH_GAP) {
      renderState(true);
      return Promise.resolve(state);
    }

    busy = true;
    lastFetchAt = Date.now();
    setZoneStatus("LIVE-MARKTDATEN WERDEN GELADEN …", "var(--cyan)");
    setMoverStatus("MARKTDATEN WERDEN NACHEINANDER GELADEN …", "var(--cyan)");

    if (!ENDPOINT || ENDPOINT.indexOf("https://") !== 0) {
      busy = false;
      setZoneStatus("SUPABASE-VERBINDUNG FEHLT", "var(--red)");
      setMoverStatus("SUPABASE-VERBINDUNG FEHLT", "var(--red)");
      return Promise.resolve(null);
    }

    var successful = 0;
    var lastError = null;

    return getToken().then(function (accessToken) {
      if (!accessToken) throw { code: "unauthorized", status: 401 };

      var chain = Promise.resolve();
      MOVER_DEFS.forEach(function (definition, position) {
        chain = chain.then(function () {
          if (position > 0) return delay(REQUEST_GAP);
          return null;
        }).then(function () {
          setMoverStatus(
            "LADE " + definition.label + " · " + (position + 1) + "/" + MOVER_DEFS.length,
            "var(--cyan)"
          );
          return loadDefinition(definition, accessToken);
        }).then(function (result) {
          if (saveAndRender(definition.label, result, false)) successful++;
          renderState(false);
        }).catch(function (error) {
          lastError = error;
          renderState(false);
        });
      });
      return chain;
    }).then(function () {
      var rendered = renderState(false);
      if (rendered === 0) {
        var message = errorMessage(lastError);
        setZoneStatus(message, "var(--red)");
        setMoverStatus(message, "var(--red)");
        document.documentElement.setAttribute("data-tl-market-state", "error");
      } else {
        document.documentElement.setAttribute(
          "data-tl-market-state",
          successful === MOVER_DEFS.length ? "live" : "partial"
        );
      }
      busy = false;
      return state;
    }).catch(function (error) {
      var cachedCount = renderState(true);
      var message = errorMessage(error);
      if (cachedCount === 0) {
        setZoneStatus(message, "var(--red)");
        setMoverStatus(message, "var(--red)");
      }
      document.documentElement.setAttribute("data-tl-market-state", "error");
      busy = false;
      return null;
    });
  }

  function startWhenReady(attempt) {
    attempt = attempt || 0;
    if (!findMoverCard() && !findZoneCard()) {
      if (attempt < 50) {
        setTimeout(function () { startWhenReady(attempt + 1); }, 250);
      }
      return;
    }

    var cached = readCache();
    if (cached) {
      state = cached;
      renderState(true);
    }

    load();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!document.hidden) load();
    }, REFRESH_MS);
  }

  window.TLMarket = {
    refresh: load,
    render: function () { return renderState(true); },
    clearCache: function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (_error) {}
      state = { payloads: {}, sources: {}, savedAt: 0 };
      lastFetchAt = 0;
      return load();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      startWhenReady(0);
    }, { once: true });
  } else {
    startWhenReady(0);
  }
})();
