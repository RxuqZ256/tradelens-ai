/* =====================================================================
   TradeLens AI – Live-Marktdaten für Übersicht, Top Movers und Zonen
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var FUNCTION_SLUG = CFG.MARKET_DATA_FUNCTION || "market-data";
  var ENDPOINT = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") +
    "/functions/v1/" + FUNCTION_SLUG;
  var CACHE_KEY = "tradelens_market_overview_v4";
  var REFRESH_MS = 5 * 60 * 1000;
  var MAX_CACHE_AGE = 15 * 60 * 1000;
  var clientInstance = null;
  var busy = false;
  var refreshTimer = null;
  var lastBundle = null;

  var MOVER_DEFS = [
    { label: "XAUUSD", symbols: ["XAU/USD"] },
    { label: "NAS100", symbols: ["NDX", "IXIC"] },
    { label: "EURUSD", symbols: ["EUR/USD"] },
    { label: "BTCUSD", symbols: ["BTC/USD"] }
  ];

  document.documentElement.setAttribute("data-tl-market-script", "v4");

  function norm(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_e) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function textLeaves(root) {
    var nodes = (root || document).querySelectorAll("*");
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length === 0 && norm(nodes[i].textContent)) result.push(nodes[i]);
    }
    return result;
  }

  function findLeaf(root, terms) {
    var leaves = textLeaves(root);
    for (var i = 0; i < leaves.length; i++) {
      var text = norm(leaves[i].textContent);
      for (var j = 0; j < terms.length; j++) {
        if (text === terms[j] || text.indexOf(terms[j]) >= 0) return leaves[i];
      }
    }
    return null;
  }

  function overviewRoot() {
    var known = document.getElementById("page-overview") ||
      document.getElementById("page-uebersicht") ||
      document.getElementById("page-dashboard");
    if (known) return known;

    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) {
      var text = norm(pages[i].textContent);
      if (text.indexOf("TOP MOVERS") >= 0 || text.indexOf("WICHTIGE ZONEN") >= 0) {
        return pages[i];
      }
    }
    return document;
  }

  function findCardByHeading(headingText) {
    var root = overviewRoot();
    var heading = findLeaf(root, [headingText]);
    if (!heading) return null;

    var node = heading;
    while (node && node !== document.body && node !== document.documentElement) {
      var text = norm(node.textContent);
      if (headingText === "TOP MOVERS") {
        if (text.indexOf("XAUUSD") >= 0 && text.indexOf("EURUSD") >= 0) return node;
      } else if (headingText === "WICHTIGE ZONEN") {
        if (text.indexOf("AKTUELLER PREIS") >= 0 && text.indexOf("WIDERSTAND 1") >= 0) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findRow(card, label, allLabels) {
    if (!card) return null;
    var leaf = findLeaf(card, [label]);
    if (!leaf) return null;

    var node = leaf.parentElement;
    while (node && node !== card) {
      var text = norm(node.textContent);
      var other = 0;
      for (var i = 0; i < allLabels.length; i++) {
        if (allLabels[i] !== label && text.indexOf(allLabels[i]) >= 0) other++;
      }
      if (other === 0) return node;
      node = node.parentElement;
    }
    return leaf.parentElement;
  }

  function setRowValue(card, label, allLabels, value, stateClass) {
    var row = findRow(card, label, allLabels);
    if (!row) return false;

    var target = row.querySelector(".pct,.val,.set-val,[data-value]");
    if (!target) {
      var children = row.children;
      for (var i = children.length - 1; i >= 0; i--) {
        if (norm(children[i].textContent) !== label) {
          target = children[i];
          break;
        }
      }
    }
    if (!target) return false;

    target.textContent = value;
    target.classList.remove("pos", "neg");
    if (stateClass) target.classList.add(stateClass);
    return true;
  }

  function ensureStatus(card, attrName) {
    if (!card) return null;
    var selector = "[" + attrName + "]";
    var status = card.querySelector(selector);
    if (status) return status;

    status = document.createElement("div");
    status.setAttribute(attrName, "true");
    status.style.cssText =
      "margin-top:8px;padding-top:7px;border-top:1px solid rgba(96,165,250,.12);" +
      "text-align:center;font-family:var(--f-body);font-size:10px;" +
      "color:var(--txt-3);letter-spacing:.2px";
    var host = card.querySelector(".in") || card;
    host.appendChild(status);
    return status;
  }

  function setZoneHeading(card) {
    var heading = findLeaf(card, ["WICHTIGE ZONEN"]);
    if (heading) heading.textContent = "WICHTIGE ZONEN – XAUUSD · M15";
  }

  function setZoneStatus(text, color) {
    var card = findCardByHeading("WICHTIGE ZONEN");
    if (!card) return;
    setZoneHeading(card);
    var status = ensureStatus(card, "data-tl-zone-status");
    status.textContent = text;
    status.style.color = color || "var(--txt-3)";
  }

  function setMoverStatus(text, color) {
    var card = findCardByHeading("TOP MOVERS");
    if (!card) return;
    var footer = findLeaf(card, ["KEINE SIMULIERTEN KURSE", "LIVE · M15", "MARKTDATEN WERDEN GELADEN"]);
    if (footer) {
      footer.textContent = text;
      footer.style.color = color || "var(--txt-3)";
      return;
    }
    var status = ensureStatus(card, "data-tl-mover-status");
    status.textContent = text;
    status.style.color = color || "var(--txt-3)";
  }

  function formatPrice(value) {
    var n = finite(value);
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

  function formatPercent(value) {
    var n = finite(value);
    if (n == null) return "—";
    var prefix = n > 0 ? "+" : "";
    return prefix + n.toFixed(2).replace(".", ",") + "%";
  }

  function formatTime(iso) {
    var d = new Date(iso || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    try {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
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
      resistance_2: round2(pivot + (high - low)),
      resistance_1: round2(2 * pivot - low),
      support_1: round2(2 * pivot - high),
      support_2: round2(pivot - (high - low))
    };
  }

  function normalizeZonePayload(payload) {
    if (!payload || payload.ok !== true) return null;

    if (payload.zones && finite(payload.price) != null) {
      return {
        price: finite(payload.price),
        zones: payload.zones,
        updatedAt: payload.updated_at || new Date().toISOString()
      };
    }

    var candles = Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload.latest || candles[0] || null;
    var price = latest ? finite(latest.close) : null;
    var basis = candles[1] || candles[0] || null;
    var zones = calculatePivots(basis);
    if (price == null || !zones) return null;

    return {
      price: price,
      zones: zones,
      updatedAt: payload.fetched_at || new Date().toISOString()
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

  function renderZones(payload, cached) {
    var data = normalizeZonePayload(payload);
    var card = findCardByHeading("WICHTIGE ZONEN");
    if (!data || !card) return false;

    var labels = ["WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS", "UNTERSTUTZUNG 1", "UNTERSTUTZUNG 2"];
    setZoneHeading(card);
    setRowValue(card, "WIDERSTAND 2", labels, formatPrice(data.zones.resistance_2));
    setRowValue(card, "WIDERSTAND 1", labels, formatPrice(data.zones.resistance_1));
    setRowValue(card, "AKTUELLER PREIS", labels, formatPrice(data.price));
    setRowValue(card, "UNTERSTUTZUNG 1", labels, formatPrice(data.zones.support_1));
    setRowValue(card, "UNTERSTUTZUNG 2", labels, formatPrice(data.zones.support_2));
    setZoneStatus(
      (cached ? "ZULETZT GELADEN" : "LIVE") + " · TWELVE DATA · " + formatTime(data.updatedAt),
      cached ? "var(--txt-3)" : "var(--green)"
    );
    return true;
  }

  function renderMovers(movers, cached) {
    var card = findCardByHeading("TOP MOVERS");
    if (!card) return false;
    var labels = MOVER_DEFS.map(function (item) { return item.label; });
    var rendered = 0;

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var item = movers && movers[label];
      if (item && finite(item.changePercent) != null) {
        var stateClass = item.changePercent >= 0 ? "pos" : "neg";
        if (setRowValue(card, label, labels, formatPercent(item.changePercent), stateClass)) rendered++;
      } else {
        setRowValue(card, label, labels, "—");
      }
    }

    setMoverStatus(
      rendered > 0
        ? ((cached ? "ZULETZT GELADEN" : "LIVE") + " · M15 · TWELVE DATA")
        : "Keine Live-Kurse verfügbar",
      rendered > 0 ? (cached ? "var(--txt-3)" : "var(--green)") : "var(--red)"
    );
    return rendered > 0;
  }

  function readCache() {
    try {
      var item = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!item || !item.savedAt || Date.now() - item.savedAt > MAX_CACHE_AGE) return null;
      return item.bundle || null;
    } catch (_e) {
      return null;
    }
  }

  function writeCache(bundle) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), bundle: bundle }));
    } catch (_e) {}
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
    } catch (_e) {
      clientInstance = null;
    }
    return clientInstance;
  }

  function getToken() {
    if (window.TLAuth && typeof window.TLAuth.getSession === "function") {
      return window.TLAuth.getSession().then(function (res) {
        return res && res.session ? res.session.access_token : null;
      }).catch(function () { return null; });
    }
    var client = directClient();
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      return res && res.data && res.data.session ? res.data.session.access_token : null;
    }).catch(function () { return null; });
  }

  function invokeMarket(symbol, outputsize, accessToken) {
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
          throw { code: body && (body.error || body.error_code), status: response.status };
        }
        return body;
      });
    });
  }

  function loadMover(def, accessToken) {
    var index = 0;
    function attempt() {
      var symbol = def.symbols[index++];
      return invokeMarket(symbol, 2, accessToken).then(function (payload) {
        var item = moverFromPayload(payload);
        if (!item) throw { code: "market_data_incomplete", status: 502 };
        return item;
      }).catch(function () {
        if (index < def.symbols.length) return attempt();
        return null;
      });
    }
    return attempt();
  }

  function errorMessage(error) {
    var code = error && error.code;
    var status = error && error.status;
    if (code === "unauthorized" || status === 401 || status === 403) return "Sitzung abgelaufen – bitte neu anmelden";
    if (status === 429 || code === "provider_error") return "Marktdaten-Limit erreicht – später erneut versuchen";
    if (code === "secret_missing") return "Twelve-Data-Zugang fehlt in Supabase";
    if (status === 404) return "Edge Function market-data nicht gefunden";
    return "Live-Marktdaten konnten nicht geladen werden";
  }

  function renderBundle(bundle, cached) {
    if (!bundle) return false;
    var zonesOk = bundle.zones ? renderZones(bundle.zones, cached) : false;
    var moversOk = bundle.movers ? renderMovers(bundle.movers, cached) : false;
    return zonesOk || moversOk;
  }

  function load() {
    if (busy) return Promise.resolve(lastBundle);
    if (!findCardByHeading("WICHTIGE ZONEN") && !findCardByHeading("TOP MOVERS")) {
      return Promise.resolve(null);
    }

    setZoneStatus("Live-Marktdaten werden geladen …", "var(--cyan)");
    setMoverStatus("Marktdaten werden geladen …", "var(--cyan)");

    if (!ENDPOINT || ENDPOINT.indexOf("https://") !== 0) {
      setZoneStatus("Supabase-Verbindung ist nicht konfiguriert", "var(--red)");
      setMoverStatus("Keine Verbindung", "var(--red)");
      return Promise.resolve(null);
    }

    busy = true;
    return getToken().then(function (accessToken) {
      if (!accessToken) throw { code: "unauthorized", status: 401 };

      var zonePromise = invokeMarket("XAU/USD", 20, accessToken).catch(function () { return null; });
      var moverPromises = MOVER_DEFS.map(function (def) {
        return loadMover(def, accessToken).then(function (item) {
          return { label: def.label, item: item };
        });
      });

      return Promise.all([zonePromise, Promise.all(moverPromises)]);
    }).then(function (results) {
      var movers = {};
      for (var i = 0; i < results[1].length; i++) {
        movers[results[1][i].label] = results[1][i].item;
      }
      var bundle = { zones: results[0], movers: movers };
      if (!bundle.zones && !renderMovers(bundle.movers, false)) {
        throw { code: "market_data_incomplete", status: 502 };
      }
      lastBundle = bundle;
      writeCache(bundle);
      renderBundle(bundle, false);
      document.documentElement.setAttribute("data-tl-market-state", "live");
      return bundle;
    }).catch(function (error) {
      if (lastBundle && renderBundle(lastBundle, true)) return null;
      var message = errorMessage(error);
      setZoneStatus(message, "var(--red)");
      setMoverStatus(message, "var(--red)");
      document.documentElement.setAttribute("data-tl-market-state", "error");
      return null;
    }).then(function (result) {
      busy = false;
      return result;
    }, function () {
      busy = false;
      return null;
    });
  }

  function startWhenReady(attempt) {
    attempt = attempt || 0;
    if (!findCardByHeading("WICHTIGE ZONEN") && !findCardByHeading("TOP MOVERS")) {
      if (attempt < 50) setTimeout(function () { startWhenReady(attempt + 1); }, 250);
      return;
    }

    var cached = readCache();
    if (cached && renderBundle(cached, true)) lastBundle = cached;
    load();

    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!document.hidden) load();
    }, REFRESH_MS);
  }

  window.TLMarket = {
    refresh: load,
    render: function () { return lastBundle ? renderBundle(lastBundle, true) : false; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { startWhenReady(0); }, { once: true });
  } else {
    startWhenReady(0);
  }
})();
