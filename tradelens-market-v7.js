(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var client = null;
  var busy = false;
  var timer = null;
  var cacheKey = "tradelens_market_v7";
  var state = { payloads: {}, sources: {}, savedAt: 0 };
  var defs = [
    { label: "XAUUSD", symbols: ["XAU/USD"], outputsize: 20 },
    { label: "EURUSD", symbols: ["EUR/USD"], outputsize: 3 },
    { label: "BTCUSD", symbols: ["BTC/USD"], outputsize: 3 },
    { label: "NAS100", symbols: ["NDX", "QQQ", "IXIC"], outputsize: 3 }
  ];

  function n(v) {
    var x = Number(v);
    return Number.isFinite(x) ? x : null;
  }

  function norm(v) {
    var s = String(v || "").toUpperCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_e) {}
    return s.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function root() {
    return document.getElementById("page-overview") || document.getElementById("page-uebersicht") || document.getElementById("page-dashboard") || document;
  }

  function moverRow(label) {
    var rows = root().querySelectorAll(".mover");
    for (var i = 0; i < rows.length; i++) {
      var sym = rows[i].querySelector(".sym");
      if (sym && norm(sym.textContent) === label) return rows[i];
    }
    return null;
  }

  function zoneRow(label) {
    var rows = root().querySelectorAll(".zr");
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i].querySelector(".lbl");
      if (el && norm(el.textContent) === label) return rows[i];
    }
    return null;
  }

  function cardOf(el) {
    return el && el.closest ? el.closest(".gf,.card") : null;
  }

  function statusNode(card, attr) {
    if (!card) return null;
    var node = card.querySelector("[" + attr + "]");
    if (node) return node;
    node = document.createElement("div");
    node.setAttribute(attr, "true");
    node.style.cssText = "margin-top:8px;padding-top:7px;border-top:1px solid rgba(96,165,250,.12);text-align:center;font-size:10px;color:var(--txt-3)";
    (card.querySelector(".in") || card).appendChild(node);
    return node;
  }

  function setZoneStatus(text, color) {
    var card = cardOf(zoneRow("AKTUELLER PREIS"));
    var node = statusNode(card, "data-market-zone-status");
    if (node) { node.textContent = text; node.style.color = color || "var(--txt-3)"; }
  }

  function setMoverStatus(text, color) {
    var card = cardOf(moverRow("XAUUSD"));
    var node = statusNode(card, "data-market-mover-status");
    if (node) { node.textContent = text; node.style.color = color || "var(--txt-3)"; }
  }

  function setMover(label, value, positive) {
    var row = moverRow(label);
    var target = row && row.querySelector(".pct");
    if (!target) return false;
    target.textContent = value;
    target.classList.remove("pos", "neg");
    target.classList.add(positive ? "pos" : "neg");
    return true;
  }

  function setZone(label, value) {
    var row = zoneRow(label);
    var target = row && row.querySelector(".val");
    if (!target) return false;
    target.textContent = value;
    return true;
  }

  function price(v) {
    var x = n(v);
    if (x == null) return "—";
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  }

  function percent(v) {
    var x = n(v);
    if (x == null) return "—";
    return (x > 0 ? "+" : "") + x.toFixed(2).replace(".", ",") + "%";
  }

  function mover(payload) {
    var candles = payload && Array.isArray(payload.candles) ? payload.candles : [];
    var current = payload && (payload.latest || candles[0]);
    var previous = candles[1];
    var a = current ? n(current.close) : null;
    var b = previous ? n(previous.close) : null;
    if (a == null || b == null || b === 0) return null;
    return ((a - b) / b) * 100;
  }

  function pivot(candle) {
    if (!candle) return null;
    var h = n(candle.high), l = n(candle.low), c = n(candle.close);
    if (h == null || l == null || c == null || h <= l) return null;
    var p = (h + l + c) / 3;
    return { r2: p + h - l, r1: 2 * p - l, s1: 2 * p - h, s2: p - h + l };
  }

  function renderXau(payload) {
    var candles = payload && Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload && (payload.latest || candles[0]);
    var levels = pivot(candles[1] || candles[0]);
    var current = latest ? n(latest.close) : null;
    var change = mover(payload);
    if (current != null && levels) {
      setZone("WIDERSTAND 2", price(levels.r2));
      setZone("WIDERSTAND 1", price(levels.r1));
      setZone("AKTUELLER PREIS", price(current));
      setZone("UNTERSTUTZUNG 1", price(levels.s1));
      setZone("UNTERSTUTZUNG 2", price(levels.s2));
      setZoneStatus("LIVE · TWELVE DATA", "var(--green)");
    }
    if (change != null) setMover("XAUUSD", percent(change), change >= 0);
  }

  function renderAll() {
    var count = 0;
    if (state.payloads.XAUUSD) { renderXau(state.payloads.XAUUSD); count++; }
    ["EURUSD", "BTCUSD", "NAS100"].forEach(function (label) {
      var change = mover(state.payloads[label]);
      if (change != null) { setMover(label, percent(change), change >= 0); count++; }
    });
    setMoverStatus(count === 4 ? "LIVE · M15 · TWELVE DATA" : "TEILWEISE GELADEN · " + count + "/4", count === 4 ? "var(--green)" : "var(--gold)");
  }

  function getClient(attempt) {
    attempt = attempt || 0;
    if (client) return Promise.resolve(client);
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" }
      });
      return Promise.resolve(client);
    }
    if (attempt >= 40) return Promise.reject(new Error("supabase_not_loaded"));
    return wait(250).then(function () { return getClient(attempt + 1); });
  }

  function invoke(symbol, outputsize) {
    return getClient().then(function (c) {
      return c.functions.invoke(CFG.MARKET_DATA_FUNCTION || "market-data", {
        body: { symbol: symbol, interval: "15min", outputsize: outputsize }
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      if (!result.data || result.data.ok !== true) throw new Error((result.data && result.data.error) || "invalid_response");
      return result.data;
    });
  }

  function invokeDefinition(def) {
    var index = 0;
    function next() {
      var symbol = def.symbols[index++];
      return invoke(symbol, def.outputsize).then(function (payload) {
        if (mover(payload) == null) throw new Error("missing_candles");
        return { payload: payload, symbol: symbol };
      }).catch(function (error) {
        if (index < def.symbols.length) return wait(1800).then(next);
        throw error;
      });
    }
    return next();
  }

  function errorText(error) {
    var message = error && error.message ? error.message : "unbekannter_fehler";
    return "FEHLER · " + String(message).slice(0, 70);
  }

  function load() {
    if (busy) return Promise.resolve();
    busy = true;
    setZoneStatus("VERBINDUNG WIRD GETESTET …", "var(--cyan)");
    setMoverStatus("LADE XAUUSD · 1/4", "var(--cyan)");
    var chain = Promise.resolve();

    defs.forEach(function (def, position) {
      chain = chain.then(function () {
        if (position) return wait(1800);
      }).then(function () {
        setMoverStatus("LADE " + def.label + " · " + (position + 1) + "/4", "var(--cyan)");
        return invokeDefinition(def);
      }).then(function (result) {
        state.payloads[def.label] = result.payload;
        state.sources[def.label] = result.symbol;
        state.savedAt = Date.now();
        try { localStorage.setItem(cacheKey, JSON.stringify(state)); } catch (_e) {}
        renderAll();
      }).catch(function (error) {
        if (def.label === "XAUUSD") {
          var text = errorText(error);
          setZoneStatus(text, "var(--red)");
          setMoverStatus(text, "var(--red)");
        }
      });
    });

    return chain.then(function () {
      renderAll();
      busy = false;
    }).catch(function (error) {
      var text = errorText(error);
      setZoneStatus(text, "var(--red)");
      setMoverStatus(text, "var(--red)");
      busy = false;
    });
  }

  function boot(attempt) {
    attempt = attempt || 0;
    if (!moverRow("XAUUSD") && !zoneRow("AKTUELLER PREIS")) {
      if (attempt < 60) setTimeout(function () { boot(attempt + 1); }, 250);
      return;
    }
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && cached.savedAt && Date.now() - cached.savedAt < 1800000) {
        state = cached;
        renderAll();
      }
    } catch (_e) {}
    load();
    clearInterval(timer);
    timer = setInterval(function () { if (!document.hidden) load(); }, 900000);
  }

  window.TLMarket = { refresh: load };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { boot(0); }, { once: true });
  else boot(0);
})();
