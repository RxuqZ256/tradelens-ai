(function () {
  "use strict";

  var frame = document.getElementById("app");
  var badge = document.getElementById("boot-status");
  var client = null;
  var state = { values: {}, zones: null, timer: null };

  var defs = [
    { label: "XAUUSD", symbols: ["XAU/USD"], outputsize: 20 },
    { label: "EURUSD", symbols: ["EUR/USD"], outputsize: 3 },
    { label: "BTCUSD", symbols: ["BTC/USD"], outputsize: 3 },
    { label: "NAS100", symbols: ["NDX", "QQQ", "IXIC"], outputsize: 3 }
  ];

  function setBadge(text, type) {
    if (!badge) return;
    badge.textContent = text;
    badge.className = type || "";
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_e) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatPrice(value) {
    var n = number(value);
    if (n == null) return "—";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function formatPercent(value) {
    var n = number(value);
    if (n == null) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(".", ",") + "%";
  }

  function appDocument() {
    return frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document));
  }

  function textLeaves(doc) {
    var all = doc.querySelectorAll("*");
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].children.length === 0 && normalize(all[i].textContent)) out.push(all[i]);
    }
    return out;
  }

  function findLeaf(doc, label) {
    var wanted = normalize(label);
    var leaves = textLeaves(doc);
    for (var i = 0; i < leaves.length; i++) {
      if (normalize(leaves[i].textContent) === wanted) return leaves[i];
    }
    return null;
  }

  function findRowFromLabel(doc, label, siblingLabels) {
    var leaf = findLeaf(doc, label);
    if (!leaf) return null;
    var node = leaf.parentElement;
    while (node && node !== doc.body) {
      var text = normalize(node.textContent);
      var other = 0;
      for (var i = 0; i < siblingLabels.length; i++) {
        if (siblingLabels[i] !== normalize(label) && text.indexOf(siblingLabels[i]) >= 0) other++;
      }
      if (other === 0 && text.indexOf(normalize(label)) >= 0) return node;
      node = node.parentElement;
    }
    return leaf.parentElement;
  }

  function findValueTarget(row, label) {
    if (!row) return null;
    var selectors = [".pct", ".val", ".set-val", "[data-value]"];
    for (var i = 0; i < selectors.length; i++) {
      var direct = row.querySelector(selectors[i]);
      if (direct) return direct;
    }

    var leaves = row.querySelectorAll("*");
    for (var j = leaves.length - 1; j >= 0; j--) {
      if (leaves[j].children.length !== 0) continue;
      var text = normalize(leaves[j].textContent);
      if (!text || text === normalize(label)) continue;
      if (text === "-" || text === "—" || /^[-+]?\d/.test(text)) return leaves[j];
    }

    var children = row.children;
    for (var k = children.length - 1; k >= 0; k--) {
      if (normalize(children[k].textContent) !== normalize(label)) return children[k];
    }
    return null;
  }

  function writeByLabel(doc, label, value, allLabels, positive) {
    var row = findRowFromLabel(doc, label, allLabels);
    var target = findValueTarget(row, label);
    if (!target) return false;
    target.textContent = value;
    target.classList.remove("pos", "neg");
    if (typeof positive === "boolean") target.classList.add(positive ? "pos" : "neg");
    return normalize(target.textContent) === normalize(value);
  }

  function setHeading(doc) {
    var leaves = textLeaves(doc);
    for (var i = 0; i < leaves.length; i++) {
      if (normalize(leaves[i].textContent).indexOf("WICHTIGE ZONEN") === 0) {
        leaves[i].textContent = "WICHTIGE ZONEN – XAUUSD · M15";
        return true;
      }
    }
    return false;
  }

  function moverChange(payload) {
    var candles = payload && Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload && (payload.latest || candles[0]);
    var previous = candles[1];
    var current = latest ? number(latest.close) : null;
    var before = previous ? number(previous.close) : null;
    if (current == null || before == null || before === 0) return null;
    return ((current - before) / before) * 100;
  }

  function pivots(candle) {
    if (!candle) return null;
    var high = number(candle.high);
    var low = number(candle.low);
    var close = number(candle.close);
    if (high == null || low == null || close == null || high <= low) return null;
    var p = (high + low + close) / 3;
    return {
      r2: p + high - low,
      r1: 2 * p - low,
      s1: 2 * p - high,
      s2: p - high + low
    };
  }

  function renderStoredValues() {
    var doc = appDocument();
    if (!doc || !doc.body) return 0;

    var moverLabels = ["XAUUSD", "NAS100", "EURUSD", "BTCUSD"];
    var zoneLabels = ["WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS", "UNTERSTÜTZUNG 1", "UNTERSTÜTZUNG 2"].map(normalize);
    var visible = 0;

    setHeading(doc);

    Object.keys(state.values).forEach(function (label) {
      var item = state.values[label];
      if (writeByLabel(doc, label, item.text, moverLabels, item.positive)) visible++;
    });

    if (state.zones) {
      if (writeByLabel(doc, "WIDERSTAND 2", state.zones.r2, zoneLabels)) visible++;
      if (writeByLabel(doc, "WIDERSTAND 1", state.zones.r1, zoneLabels)) visible++;
      if (writeByLabel(doc, "AKTUELLER PREIS", state.zones.current, zoneLabels)) visible++;
      if (writeByLabel(doc, "UNTERSTÜTZUNG 1", state.zones.s1, zoneLabels)) visible++;
      if (writeByLabel(doc, "UNTERSTÜTZUNG 2", state.zones.s2, zoneLabels)) visible++;
    }

    return visible;
  }

  function invoke(symbol, outputsize) {
    return client.functions.invoke("market-data", {
      body: { symbol: symbol, interval: "15min", outputsize: outputsize }
    }).then(function (result) {
      if (result.error) throw result.error;
      if (!result.data || result.data.ok !== true) throw new Error((result.data && result.data.error) || "invalid_response");
      return result.data;
    });
  }

  function invokeDefinition(definition) {
    var index = 0;
    function attempt() {
      var symbol = definition.symbols[index++];
      return invoke(symbol, definition.outputsize).then(function (payload) {
        if (moverChange(payload) == null) throw new Error("missing_candles");
        return { payload: payload, symbol: symbol };
      }).catch(function (error) {
        if (index < definition.symbols.length) return wait(1500).then(attempt);
        throw error;
      });
    }
    return attempt();
  }

  function storeResult(label, payload) {
    var change = moverChange(payload);
    if (change != null) {
      state.values[label] = {
        text: formatPercent(change),
        positive: change >= 0
      };
    }

    if (label === "XAUUSD") {
      var candles = Array.isArray(payload.candles) ? payload.candles : [];
      var latest = payload.latest || candles[0];
      var current = latest ? number(latest.close) : null;
      var levels = pivots(candles[1] || candles[0]);
      if (current != null && levels) {
        state.zones = {
          r2: formatPrice(levels.r2),
          r1: formatPrice(levels.r1),
          current: formatPrice(current),
          s1: formatPrice(levels.s1),
          s2: formatPrice(levels.s2)
        };
      }
    }
  }

  function boot() {
    var doc = appDocument();
    if (!doc || !doc.body) {
      setBadge("App-Dokument nicht erreichbar", "err");
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      setBadge("Supabase-Bibliothek fehlt", "err");
      return;
    }

    client = window.supabase.createClient(
      "https://afdletrvfhfmcuhlisqq.supabase.co",
      "sb_publishable_xge0UxBMeTeyvs0NcrGbuw_UzG6LkpY",
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" } }
    );

    var loaded = 0;
    var chain = Promise.resolve();
    defs.forEach(function (definition, position) {
      chain = chain.then(function () {
        if (position > 0) return wait(1500);
      }).then(function () {
        setBadge("Lade " + definition.label + " · " + (position + 1) + "/4");
        return invokeDefinition(definition);
      }).then(function (result) {
        storeResult(definition.label, result.payload);
        var visible = renderStoredValues();
        if (state.values[definition.label]) loaded++;
        setBadge("Geladen " + loaded + "/4 · sichtbar " + visible, loaded === 4 ? "ok" : "warn");
      }).catch(function (error) {
        setBadge("Fehler " + definition.label + " · " + String(error && error.message || error).slice(0, 55), "err");
      });
    });

    chain.then(function () {
      var visible = renderStoredValues();
      setBadge("Live-Daten " + loaded + "/4 · sichtbar " + visible, visible >= 9 ? "ok" : "warn");
      clearInterval(state.timer);
      state.timer = setInterval(renderStoredValues, 1000);
      setTimeout(function () {
        clearInterval(state.timer);
        state.timer = setInterval(renderStoredValues, 15000);
      }, 30000);
    });
  }

  if (frame) frame.addEventListener("load", function () { setTimeout(boot, 700); });
})();
