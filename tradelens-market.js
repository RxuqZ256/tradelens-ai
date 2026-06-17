/* =====================================================================
   TradeLens AI – robuste Live-Marktdaten für die Übersicht
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var FUNCTION_SLUG = CFG.MARKET_DATA_FUNCTION || "market-data";
  var ENDPOINT = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") +
    "/functions/v1/" + FUNCTION_SLUG;
  var CACHE_KEY = "tradelens_market_xauusd_m15_v3";
  var REFRESH_MS = 5 * 60 * 1000;
  var MAX_CACHE_AGE = 15 * 60 * 1000;
  var clientInstance = null;
  var lastPayload = null;
  var busy = false;
  var refreshTimer = null;
  var bootObserver = null;
  var bootAttempts = 0;

  document.documentElement.setAttribute("data-tl-market-script", "loaded");

  function norm(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_e) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  var ZONE_LABELS = [
    "WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS",
    "UNTERSTUTZUNG 1", "UNTERSTUTZUNG 2"
  ];

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

  function activeOverviewPage() {
    var known = document.getElementById("page-overview") ||
      document.getElementById("page-uebersicht") ||
      document.getElementById("page-dashboard");
    if (known) return known;

    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) {
      var t = norm(pages[i].textContent);
      if (t.indexOf("WICHTIGE ZONEN") >= 0 && t.indexOf("AKTUELLER PREIS") >= 0) {
        return pages[i];
      }
    }
    return document;
  }

  function findZonesCard() {
    var root = activeOverviewPage();
    var heading = findLeaf(root, ["WICHTIGE ZONEN"]);
    if (!heading) return null;

    var node = heading;
    while (node && node !== document.body && node !== document.documentElement) {
      var t = norm(node.textContent);
      if (
        t.indexOf("WIDERSTAND 2") >= 0 &&
        t.indexOf("WIDERSTAND 1") >= 0 &&
        t.indexOf("AKTUELLER PREIS") >= 0 &&
        t.indexOf("UNTERSTUTZUNG 1") >= 0 &&
        t.indexOf("UNTERSTUTZUNG 2") >= 0
      ) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findRow(card, labels) {
    var label = findLeaf(card, labels);
    if (!label) return null;

    var node = label.parentElement;
    while (node && node !== card) {
      var t = norm(node.textContent);
      var otherCount = 0;
      for (var i = 0; i < ZONE_LABELS.length; i++) {
        if (t.indexOf(ZONE_LABELS[i]) >= 0 && labels.indexOf(ZONE_LABELS[i]) < 0) {
          otherCount++;
        }
      }
      if (otherCount === 0) return node;
      node = node.parentElement;
    }
    return label.parentElement;
  }

  function setRowValue(card, labels, value) {
    var row = findRow(card, labels);
    if (!row) return false;

    var target = row.querySelector(".val,.set-val,.pct,[data-value]");
    if (!target) {
      var children = row.children;
      for (var i = children.length - 1; i >= 0; i--) {
        if (norm(children[i].textContent) !== norm(labels[0])) {
          target = children[i];
          break;
        }
      }
    }
    if (!target) return false;
    target.textContent = value;
    return true;
  }

  function setHeading(card) {
    var heading = findLeaf(card, ["WICHTIGE ZONEN"]);
    if (heading) heading.textContent = "WICHTIGE ZONEN – XAUUSD · M15";
  }

  function ensureStatus(card) {
    var status = card.querySelector("[data-tl-market-status]");
    if (status) return status;

    status = document.createElement("div");
    status.setAttribute("data-tl-market-status", "true");
    status.style.cssText =
      "margin-top:9px;padding-top:8px;border-top:1px solid rgba(96,165,250,.12);" +
      "text-align:center;font-family:var(--f-body);font-size:10.5px;" +
      "color:var(--txt-3);letter-spacing:.25px";
    var host = card.querySelector(".in") || card;
    host.appendChild(status);
    return status;
  }

  function setStatus(text, color) {
    var card = findZonesCard();
    if (!card) return;
    setHeading(card);
    var status = ensureStatus(card);
    status.textContent = text;
    status.style.color = color || "var(--txt-3)";
  }

  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
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

  function formatTime(iso) {
    var d = new Date(iso || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    try {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return "";
    }
  }

  function pivots(candle) {
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

  function normalizePayload(payload) {
    if (!payload || payload.ok !== true) return null;

    if (payload.zones && finite(payload.price) != null) {
      return {
        price: finite(payload.price),
        zones: payload.zones,
        updated_at: payload.updated_at || new Date().toISOString()
      };
    }

    var candles = Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload.latest || candles[0] || null;
    var price = latest ? finite(latest.close) : null;
    var basis = candles[1] || candles[0] || null;
    var zones = pivots(basis);
    if (price == null || !zones) return null;

    return {
      price: price,
      zones: zones,
      updated_at: payload.fetched_at || new Date().toISOString()
    };
  }

  function render(payload, cached) {
    var data = normalizePayload(payload);
    var card = findZonesCard();
    if (!data || !card) return false;

    setHeading(card);
    setRowValue(card, ["WIDERSTAND 2", "RESISTANCE 2", "R2"], formatPrice(data.zones.resistance_2));
    setRowValue(card, ["WIDERSTAND 1", "RESISTANCE 1", "R1"], formatPrice(data.zones.resistance_1));
    setRowValue(card, ["AKTUELLER PREIS", "AKTUELL", "CURRENT PRICE"], formatPrice(data.price));
    setRowValue(card, ["UNTERSTUTZUNG 1", "SUPPORT 1", "S1"], formatPrice(data.zones.support_1));
    setRowValue(card, ["UNTERSTUTZUNG 2", "SUPPORT 2", "S2"], formatPrice(data.zones.support_2));

    setStatus(
      (cached ? "ZULETZT GELADEN" : "LIVE") + " · TWELVE DATA · " +
        formatTime(data.updated_at),
      cached ? "var(--txt-3)" : "var(--green)"
    );
    return true;
  }

  function readCache() {
    try {
      var item = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!item || !item.saved_at || Date.now() - item.saved_at > MAX_CACHE_AGE) return null;
      return item.payload || null;
    } catch (_e) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        saved_at: Date.now(),
        payload: payload
      }));
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

  function token() {
    if (window.TLAuth && typeof window.TLAuth.getSession === "function") {
      return window.TLAuth.getSession().then(function (res) {
        return res && res.session ? res.session.access_token : null;
      }).catch(function () { return null; });
    }

    var c = directClient();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (res) {
      return res && res.data && res.data.session
        ? res.data.session.access_token
        : null;
    }).catch(function () { return null; });
  }

  function errorText(code, status) {
    if (code === "unauthorized" || status === 401 || status === 403) {
      return "Sitzung abgelaufen – bitte neu anmelden";
    }
    if (status === 429 || code === "provider_error") {
      return "Marktdaten-Limit erreicht – später erneut versuchen";
    }
    if (code === "secret_missing") {
      return "Twelve-Data-Zugang fehlt in Supabase";
    }
    if (status === 404) {
      return "Edge Function market-data nicht gefunden";
    }
    return "Live-Marktdaten konnten nicht geladen werden";
  }

  function load() {
    if (busy) return Promise.resolve(lastPayload);
    var card = findZonesCard();
    if (!card) return Promise.resolve(null);

    setHeading(card);
    setStatus("Live-Marktdaten werden geladen …", "var(--cyan)");

    if (!ENDPOINT || ENDPOINT.indexOf("https://") !== 0) {
      setStatus("Supabase-Verbindung ist nicht konfiguriert", "var(--red)");
      return Promise.resolve(null);
    }

    busy = true;
    return token().then(function (accessToken) {
      if (!accessToken) throw { code: "unauthorized", status: 401 };

      return fetch(ENDPOINT, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Authorization": "Bearer " + accessToken,
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
          throw {
            code: body && (body.error || body.error_code),
            status: response.status
          };
        }
        if (!normalizePayload(body)) throw { code: "market_data_incomplete", status: 502 };
        return body;
      });
    }).then(function (payload) {
      lastPayload = payload;
      writeCache(payload);
      render(payload, false);
      return payload;
    }).catch(function (error) {
      if (lastPayload && render(lastPayload, true)) return null;
      setStatus(errorText(error && error.code, error && error.status), "var(--red)");
      return null;
    }).then(function (result) {
      busy = false;
      return result;
    }, function () {
      busy = false;
      return null;
    });
  }

  function startWhenReady() {
    var card = findZonesCard();
    if (!card) {
      bootAttempts++;
      if (bootAttempts < 30) setTimeout(startWhenReady, 300);
      return;
    }

    setHeading(card);
    var cached = readCache();
    if (cached && render(cached, true)) lastPayload = cached;
    load();

    if (bootObserver) {
      bootObserver.disconnect();
      bootObserver = null;
    }

    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!document.hidden) load();
    }, REFRESH_MS);
  }

  if (window.MutationObserver) {
    bootObserver = new MutationObserver(function () {
      if (findZonesCard()) startWhenReady();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.TLMarket = {
    refresh: load,
    render: function () { return lastPayload ? render(lastPayload, true) : false; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady, { once: true });
  } else {
    startWhenReady();
  }
})();