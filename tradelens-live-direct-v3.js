(function () {
  "use strict";

  var frame = document.getElementById("app");
  var badge = document.getElementById("boot-status");
  var client = null;
  var busy = false;
  var state = {
    values: {},
    zones: null,
    errors: {},
    renderTimer: null,
    refreshTimer: null,
    lastRefreshAt: 0
  };

  var M15_MS = 15 * 60 * 1000;
  var PROVIDER_DELAY_MS = 1800;
  var REFRESH_AFTER_CLOSE_MS = 20000;

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
    badge.style.display = "block";
    badge.textContent = text;
    badge.className = type || "";
  }

  function hideBadge(delay) {
    if (!badge) return;
    setTimeout(function () {
      badge.style.display = "none";
    }, delay || 0);
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
        if (index < definition.requests.length) return wait(PROVIDER_DELAY_MS).then(attempt);
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

  function retryNas100Once(showProgress) {
    if (state.values.NAS100) return Promise.resolve();
    if (showProgress) setBadge("NAS100 wird nach kurzer Pause erneut geladen …", "warn");
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

  function runCycle(showProgress) {
    if (busy) return Promise.resolve();
    busy = true;
    var fresh = {};
    state.errors = {};

    var chain = Promise.resolve();
    definitions.forEach(function (definition, position) {
      chain = chain.then(function () {
        if (position > 0) return wait(PROVIDER_DELAY_MS);
      }).then(function () {
        if (showProgress) setBadge("Lade " + definition.label + " · " + (position + 1) + "/4");
        return invokeDefinition(definition);
      }).then(function (result) {
        storeResult(definition.label, result.payload, result.source);
        fresh[definition.label] = true;
        renderStored();
      }).catch(function (error) {
        state.errors[definition.label] = String(error && error.message || error || "nicht verfügbar");
      });
    });

    return chain.then(function () {
      if (!state.values.NAS100) return retryNas100Once(showProgress);
    }).then(function () {
      state.lastRefreshAt = Date.now();
      var visible = renderStored();
      var loaded = loadedCount();

      if (showProgress) {
        if (loaded === 4 && visible >= 9) {
          setBadge("Live-Daten 4/4 · sichtbar 9", "ok");
          hideBadge(1400);
        } else if (!state.values.NAS100 && state.errors.NAS100) {
          setBadge("NAS100: " + state.errors.NAS100.slice(0, 55), "warn");
        } else {
          setBadge("Live-Daten " + loaded + "/4 · sichtbar " + visible, "warn");
        }
      }
      busy = false;
    }).catch(function (error) {
      busy = false;
      if (showProgress) setBadge("Marktdaten: " + String(error && error.message || error).slice(0, 55), "err");
    });
  }

  function msUntilNextM15Refresh() {
    var now = Date.now();
    var nextClose = Math.ceil(now / M15_MS) * M15_MS;
    return Math.max(1000, nextClose + REFRESH_AFTER_CLOSE_MS - now);
  }

  function scheduleNextRefresh() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(function () {
      if (document.hidden) {
        scheduleNextRefresh();
        return;
      }
      runCycle(false).then(scheduleNextRefresh);
    }, msUntilNextM15Refresh());
  }

  function startRenderGuard() {
    clearInterval(state.renderTimer);
    state.renderTimer = setInterval(renderStored, 1000);
    setTimeout(function () {
      clearInterval(state.renderTimer);
      state.renderTimer = setInterval(renderStored, 15000);
    }, 30000);
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

    runCycle(true).then(function () {
      startRenderGuard();
      scheduleNextRefresh();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.lastRefreshAt && Date.now() - state.lastRefreshAt > M15_MS + 60000) {
        runCycle(false).then(scheduleNextRefresh);
      }
    });
  }

  if (frame) frame.addEventListener("load", function () { setTimeout(boot, 700); });
})();
