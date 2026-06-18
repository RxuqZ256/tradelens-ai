(function () {
  "use strict";

  var frame = document.getElementById("app");
  var badge = document.getElementById("boot-status");
  var client = null;
  var state = { values: {}, zones: null, timer: null, errors: {} };

  // NAS100 wird bewusst direkt nach XAUUSD geladen. So trifft der letzte
  // Markt nicht mehr auf das API-Minutenlimit. QQQ dient als handelbarer
  // Nasdaq-100-Proxy; NDX und IXIC bleiben als technische Fallbacks.
  var definitions = [
    { label: "XAUUSD", requests: [{ symbol: "XAU/USD", interval: "15min", outputsize: 20 }] },
    { label: "NAS100", requests: [
      { symbol: "QQQ", interval: "15min", outputsize: 3 },
      { symbol: "NDX", interval: "15min", outputsize: 3 },
      { symbol: "IXIC", interval: "15min", outputsize: 3 }
    ] },
    { label: "EURUSD", requests: [{ symbol: "EUR/USD", interval: "15min", outputsize: 3 }] },
    { label: "BTCUSD", requests: [{ symbol: "BTC/USD", interval: "15min", outputsize: 3 }] }
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
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatPrice(value) {
    var n = finite(value);
    if (n == null) return "—";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function formatPercent(value) {
    var n = finite(value);
    if (n == null) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(".", ",") + "%";
  }

  function appDocument() {
    return frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document));
  }

  function textLeaves(doc) {
    var all = doc.querySelectorAll("*");
    var leaves = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].children.length === 0 && normalize(all[i].textContent)) leaves.push(all[i]);
    }
    return leaves;
  }

  function findLeaf(doc, label) {
    var wanted = normalize(label);
    var leaves = textLeaves(doc);
    for (var i = 0; i < leaves.length; i++) {
      if (normalize(leaves[i].textContent) === wanted) return leaves[i];
    }
    return null;
  }

  function findRow(doc, label, siblingLabels) {
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

  function writeValue(doc, label, value, allLabels, positive, source) {
    var row = findRow(doc, label, allLabels);
    var target = findValueTarget(row, label);
    if (!target) return false;
    target.textContent = value;
    target.classList.remove("pos", "neg");
    if (typeof positive === "boolean") target.classList.add(positive ? "pos" : "neg");
    if (row && source) row.setAttribute("data-market-source", source);
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

  function calculateChange(payload) {
    var candles = payload && Array.isArray(payload.candles) ? payload.candles : [];
    var latest = payload && (payload.latest || candles[0]);
    var previous = candles[1];
    var current = latest ? finite(latest.close) : null;
    var before = previous ? finite(previous.close) : null;
    if (current == null || before == null || before === 0) return null;
    return ((current - before) / before) * 100;
  }

  function calculatePivots(candle) {
    if (!candle) return null;
    var high = finite(candle.high);
    var low = finite(candle.low);
    var close = finite(candle.close);
    if (high == null || low == null || close == null || high <= low) return null;
    var pivot = (high + low + close) / 3;
    return {
      r2: pivot + high - low,
      r1: 2 * pivot - low,
      s1: 2 * pivot - high,
      s2: pivot - high + low
    };
  }

  function renderStored() {
    var doc = appDocument();
    if (!doc || !doc.body) return 0;

    var moverLabels = ["XAUUSD", "NAS100", "EURUSD", "BTCUSD"];
    var zoneLabels = ["WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS", "UNTERSTÜTZUNG 1", "UNTERSTÜTZUNG 2"].map(normalize);
    var visible = 0;
    setHeading(doc);

    Object.keys(state.values).forEach(function (label) {
      var item = state.values[label];
      if (writeValue(doc, label, item.text, moverLabels, item.positive, item.source)) visible++;
    });

    if (state.zones) {
      if (writeValue(doc, "WIDERSTAND 2", state.zones.r2, zoneLabels)) visible++;
      if (writeValue(doc, "WIDERSTAND 1", state.zones.r1, zoneLabels)) visible++;
      if (writeValue(doc, "AKTUELLER PREIS", state.zones.current, zoneLabels)) visible++;
      if (writeValue(doc, "UNTERSTÜTZUNG 1", state.zones.s1, zoneLabels)) visible++;
      if (writeValue(doc, "UNTERSTÜTZUNG 2", state.zones.s2, zoneLabels)) visible++;
    }
    return visible;
  }

  function invoke(request) {
    return client.functions.invoke("market-data", {
      body: {
        symbol: request.symbol,
        interval: request.interval,
        outputsize: request.outputsize
      }
    }).then(function (result) {
      if (result.error) throw result.error;
      if (!result.data || result.data.ok !== true) {
        throw new Error((result.data && (result.data.message || result.data.error)) || "invalid_response");
      }
      return result.data;
    });
  }

  function invokeDefinition(definition) {
    var index = 0;
    var lastError = null;

    function attempt() {
      var request = definition.requests[index++];
      return invoke(request).then(function (payload) {
        if (calculateChange(payload) == null) throw new Error("missing_candles");
        return { payload: payload, source: request.symbol };
      }).catch(function (error) {
        lastError = error;
        if (index < definition.requests.length) return wait(1800).then(attempt);
        throw lastError;
      });
    }
    return attempt();
  }

  function storeResult(label, payload, source) {
    var change = calculateChange(payload);
    if (change != null) {
      state.values[label] = {
        text: formatPercent(change),
        positive: change >= 0,
        source: source
      };
    }

    if (label === "XAUUSD") {
      var candles = Array.isArray(payload.candles) ? payload.candles : [];
      var latest = payload.latest || candles[0];
      var current = latest ? finite(latest.close) : null;
      var levels = calculatePivots(candles[1] || candles[0]);
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

  function loadedCount() {
    return Object.keys(state.values).length;
  }

  function finalBadge() {
    var loaded = loadedCount();
    var visible = renderStored();
    if (loaded === 4 && visible >= 9) {
      setBadge("Live-Daten 4/4 · sichtbar 9", "ok");
      return;
    }
    if (!state.values.NAS100 && state.errors.NAS100) {
      setBadge("Live-Daten " + loaded + "/4 · NAS100: " + state.errors.NAS100.slice(0, 45), "warn");
      return;
    }
    setBadge("Live-Daten " + loaded + "/4 · sichtbar " + visible, "warn");
  }

  function retryNas100Once() {
    if (state.values.NAS100) return Promise.resolve();
    setBadge("NAS100 wird nach kurzer Pause erneut geladen …", "warn");
    return wait(65000).then(function () {
      return invokeDefinition(definitions[1]);
    }).then(function (result) {
      storeResult("NAS100", result.payload, result.source);
      delete state.errors.NAS100;
      renderStored();
    }).catch(function (error) {
      state.errors.NAS100 = String(error && error.message || error || "nicht verfügbar");
    });
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

    var chain = Promise.resolve();
    definitions.forEach(function (definition, position) {
      chain = chain.then(function () {
        if (position > 0) return wait(1800);
      }).then(function () {
        setBadge("Lade " + definition.label + " · " + (position + 1) + "/4");
        return invokeDefinition(definition);
      }).then(function (result) {
        storeResult(definition.label, result.payload, result.source);
        delete state.errors[definition.label];
        var visible = renderStored();
        setBadge("Geladen " + loadedCount() + "/4 · sichtbar " + visible, loadedCount() === 4 ? "ok" : "warn");
      }).catch(function (error) {
        state.errors[definition.label] = String(error && error.message || error || "nicht verfügbar");
        finalBadge();
      });
    });

    chain.then(function () {
      return retryNas100Once();
    }).then(function () {
      finalBadge();
      clearInterval(state.timer);
      state.timer = setInterval(renderStored, 1000);
      setTimeout(function () {
        clearInterval(state.timer);
        state.timer = setInterval(renderStored, 15000);
      }, 30000);
    });
  }

  if (frame) frame.addEventListener("load", function () { setTimeout(boot, 700); });
})();
