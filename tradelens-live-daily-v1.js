(function () {
  "use strict";

  var frame = document.getElementById("app");
  var client = null;
  var busy = false;
  var refreshTimer = null;
  var renderTimer = null;
  var lastRefreshAt = 0;

  var state = {
    movers: {},
    zones: null
  };

  var M15_MS = 15 * 60 * 1000;
  var REQUEST_GAP_MS = 1800;
  var REFRESH_AFTER_CLOSE_MS = 20000;

  var DAILY_DEFINITIONS = [
    { label: "XAUUSD", requests: [{ symbol: "XAU/USD", outputsize: 3 }] },
    { label: "NAS100", requests: [
      { symbol: "QQQ", outputsize: 3 },
      { symbol: "NDX", outputsize: 3 },
      { symbol: "IXIC", outputsize: 3 }
    ] },
    { label: "EURUSD", requests: [{ symbol: "EUR/USD", outputsize: 3 }] },
    { label: "BTCUSD", requests: [{ symbol: "BTC/USD", outputsize: 3 }] }
  ];

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatPrice(value) {
    var number = finite(value);
    if (number == null) return "—";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }

  function formatPercent(value) {
    var number = finite(value);
    if (number == null) return "—";
    return (number > 0 ? "+" : "") + number.toFixed(2).replace(".", ",") + "%";
  }

  function appWindow() {
    try { return frame && frame.contentWindow ? frame.contentWindow : null; }
    catch (_error) { return null; }
  }

  function appDocument() {
    var win = appWindow();
    try { return win ? win.document : null; }
    catch (_error) { return null; }
  }

  function textLeaves(doc) {
    var nodes = doc.querySelectorAll("*");
    var leaves = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length === 0 && normalize(nodes[i].textContent)) leaves.push(nodes[i]);
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

  function writeValue(doc, label, value, labels, positive) {
    var row = findRow(doc, label, labels);
    var target = findValueTarget(row, label);
    if (!target) return false;
    target.textContent = value;
    target.classList.remove("pos", "neg");
    if (typeof positive === "boolean") target.classList.add(positive ? "pos" : "neg");
    return true;
  }

  function setZonesHeading(doc) {
    var leaves = textLeaves(doc);
    for (var i = 0; i < leaves.length; i++) {
      if (normalize(leaves[i].textContent).indexOf("WICHTIGE ZONEN") === 0) {
        leaves[i].textContent = "WICHTIGE ZONEN – XAUUSD · M15";
        return;
      }
    }
  }

  function setMoversFooter(doc) {
    var leaves = textLeaves(doc);
    for (var i = 0; i < leaves.length; i++) {
      var text = normalize(leaves[i].textContent);
      if (text === "KEINE SIMULIERTEN KURSE" || text.indexOf("ZULETZT GELADEN") === 0) {
        leaves[i].textContent = "TAGESVERÄNDERUNG · LIVE-DATEN";
        return;
      }
    }
  }

  function renderMarkets() {
    var doc = appDocument();
    if (!doc || !doc.body) return;

    var moverLabels = ["XAUUSD", "NAS100", "EURUSD", "BTCUSD"];
    var zoneLabels = ["WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS", "UNTERSTÜTZUNG 1", "UNTERSTÜTZUNG 2"].map(normalize);

    Object.keys(state.movers).forEach(function (label) {
      var value = state.movers[label];
      writeValue(doc, label, formatPercent(value), moverLabels, value >= 0);
    });

    setMoversFooter(doc);

    if (state.zones) {
      setZonesHeading(doc);
      writeValue(doc, "WIDERSTAND 2", formatPrice(state.zones.r2), zoneLabels);
      writeValue(doc, "WIDERSTAND 1", formatPrice(state.zones.r1), zoneLabels);
      writeValue(doc, "AKTUELLER PREIS", formatPrice(state.zones.current), zoneLabels);
      writeValue(doc, "UNTERSTÜTZUNG 1", formatPrice(state.zones.s1), zoneLabels);
      writeValue(doc, "UNTERSTÜTZUNG 2", formatPrice(state.zones.s2), zoneLabels);
    }
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

  function invoke(symbol, interval, outputsize) {
    return client.functions.invoke("market-data", {
      body: { symbol: symbol, interval: interval, outputsize: outputsize }
    }).then(function (result) {
      if (result.error) throw result.error;
      if (!result.data || result.data.ok !== true) {
        throw new Error((result.data && (result.data.message || result.data.error)) || "invalid_response");
      }
      return result.data;
    });
  }

  function invokeDailyDefinition(definition) {
    var index = 0;
    var lastError = null;

    function attempt() {
      var request = definition.requests[index++];
      return invoke(request.symbol, "1day", request.outputsize).then(function (payload) {
        if (calculateChange(payload) == null) throw new Error("missing_daily_candles");
        return payload;
      }).catch(function (error) {
        lastError = error;
        if (index < definition.requests.length) return wait(REQUEST_GAP_MS).then(attempt);
        throw lastError;
      });
    }

    return attempt();
  }

  function loadDailyMovers() {
    var chain = Promise.resolve();

    DAILY_DEFINITIONS.forEach(function (definition, position) {
      chain = chain.then(function () {
        if (position > 0) return wait(REQUEST_GAP_MS);
      }).then(function () {
        return invokeDailyDefinition(definition);
      }).then(function (payload) {
        var change = calculateChange(payload);
        if (change != null) state.movers[definition.label] = change;
        renderMarkets();
      }).catch(function () {
        return null;
      });
    });

    return chain;
  }

  function loadM15Zones() {
    return wait(REQUEST_GAP_MS).then(function () {
      return invoke("XAU/USD", "15min", 3);
    }).then(function (payload) {
      var candles = Array.isArray(payload.candles) ? payload.candles : [];
      var latest = payload.latest || candles[0];
      var current = latest ? finite(latest.close) : null;
      var levels = calculatePivots(candles[1] || candles[0]);
      if (current != null && levels) {
        state.zones = {
          current: current,
          r1: levels.r1,
          r2: levels.r2,
          s1: levels.s1,
          s2: levels.s2
        };
      }
      renderMarkets();
    }).catch(function () {
      return null;
    });
  }

  function runCycle() {
    if (busy) return Promise.resolve();
    busy = true;

    return loadDailyMovers().then(loadM15Zones).then(function () {
      lastRefreshAt = Date.now();
      busy = false;
      renderMarkets();
    }).catch(function () {
      busy = false;
      renderMarkets();
    });
  }

  function msUntilNextRefresh() {
    var now = Date.now();
    var nextClose = Math.ceil(now / M15_MS) * M15_MS;
    return Math.max(1000, nextClose + REFRESH_AFTER_CLOSE_MS - now);
  }

  function scheduleNextRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      if (document.hidden) {
        scheduleNextRefresh();
        return;
      }
      runCycle().then(scheduleNextRefresh);
    }, msUntilNextRefresh());
  }

  function startRenderGuard() {
    clearInterval(renderTimer);
    renderTimer = setInterval(renderMarkets, 1000);
    setTimeout(function () {
      clearInterval(renderTimer);
      renderTimer = setInterval(renderMarkets, 5000);
    }, 30000);
  }

  function boot() {
    var doc = appDocument();
    if (!doc || !doc.body) return;
    if (!window.supabase || !window.supabase.createClient) return;

    client = window.supabase.createClient(
      "https://afdletrvfhfmcuhlisqq.supabase.co",
      "sb_publishable_xge0UxBMeTeyvs0NcrGbuw_UzG6LkpY",
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" } }
    );

    renderMarkets();
    runCycle().then(function () {
      startRenderGuard();
      scheduleNextRefresh();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && lastRefreshAt && Date.now() - lastRefreshAt > M15_MS + 60000) {
        runCycle().then(scheduleNextRefresh);
      }
    });
  }

  if (frame) {
    var doc = appDocument();
    if (doc && doc.readyState !== "loading") setTimeout(boot, 200);
    else frame.addEventListener("load", function () { setTimeout(boot, 200); }, { once: true });
  }
})();
