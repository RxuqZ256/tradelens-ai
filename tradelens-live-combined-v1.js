(function () {
  "use strict";

  var frame = document.getElementById("app");
  var client = null;
  var busy = false;
  var refreshTimer = null;
  var renderTimer = null;
  var state = {
    movers: {},
    zones: null,
    sources: {},
    lastRefreshAt: 0
  };

  var PREF_KEY = "tradelens_daily_briefing_market_v1";
  var M15_MS = 15 * 60 * 1000;
  var REQUEST_GAP_MS = 1800;
  var REFRESH_AFTER_CLOSE_MS = 20000;

  var DEFINITIONS = [
    { label: "XAUUSD", requests: [{ symbol: "XAU/USD", outputsize: 20 }] },
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

  function renderMarkets() {
    var doc = appDocument();
    if (!doc || !doc.body) return;

    var moverLabels = ["XAUUSD", "NAS100", "EURUSD", "BTCUSD"];
    var zoneLabels = ["WIDERSTAND 2", "WIDERSTAND 1", "AKTUELLER PREIS", "UNTERSTÜTZUNG 1", "UNTERSTÜTZUNG 2"].map(normalize);

    Object.keys(state.movers).forEach(function (label) {
      var value = state.movers[label];
      writeValue(doc, label, formatPercent(value), moverLabels, value >= 0);
    });

    if (state.zones) {
      setZonesHeading(doc);
      writeValue(doc, "WIDERSTAND 2", formatPrice(state.zones.r2), zoneLabels);
      writeValue(doc, "WIDERSTAND 1", formatPrice(state.zones.r1), zoneLabels);
      writeValue(doc, "AKTUELLER PREIS", formatPrice(state.zones.current), zoneLabels);
      writeValue(doc, "UNTERSTÜTZUNG 1", formatPrice(state.zones.s1), zoneLabels);
      writeValue(doc, "UNTERSTÜTZUNG 2", formatPrice(state.zones.s2), zoneLabels);
    }
  }

  function currentPreference() {
    var win = appWindow();
    var value = null;
    try { value = win && win.localStorage ? win.localStorage.getItem(PREF_KEY) : null; }
    catch (_error) {}
    return ["XAUUSD", "NAS100", "EURUSD", "BTCUSD", "MARKET"].indexOf(value) >= 0 ? value : "XAUUSD";
  }

  function ensureBriefingStyles(doc) {
    if (doc.getElementById("tl-combined-briefing-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-combined-briefing-style";
    style.textContent = [
      ".tl-cb{display:flex;flex-direction:column;gap:11px}",
      ".tl-cb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-cb-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.7px;color:#f8fafc}",
      ".tl-cb-date{font-family:var(--f-body);font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-cb-status{font-family:var(--f-disp);font-size:9px;font-weight:700;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-cb-status.wait{color:var(--gold);border-color:rgba(255,200,87,.34);background:rgba(255,200,87,.08)}",
      ".tl-cb-summary{font-family:var(--f-body);font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-cb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-cb-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-cb-stat small{display:block;font-family:var(--f-disp);font-size:8px;letter-spacing:.8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-cb-stat strong{display:block;font-family:var(--f-body);font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f8fafc}",
      ".tl-cb-stat strong.pos{color:var(--green-2)}",
      ".tl-cb-stat strong.neg{color:var(--red)}",
      ".tl-cb-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px}",
      ".tl-cb-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-cb-focus p{font-family:var(--f-body);font-size:12px;line-height:1.43;color:var(--txt-2);margin-top:3px}",
      ".tl-cb-button{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;padding:2px 0;cursor:pointer}"
    ].join("\n");
    doc.head.appendChild(style);
  }

  function germanDate() {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }

  function momentumLabel(value) {
    var absolute = Math.abs(value);
    if (absolute >= 0.15) return "Stark";
    if (absolute >= 0.05) return "Moderat";
    return "Ruhig";
  }

  function direction(value) {
    if (value > 0.01) return { label: "Bullisch", className: "pos" };
    if (value < -0.01) return { label: "Bärisch", className: "neg" };
    return { label: "Neutral", className: "" };
  }

  function openAnalysis(doc) {
    var items = doc.querySelectorAll("button,a,[role='button'],.nav-item,.tab");
    for (var i = 0; i < items.length; i++) {
      if (normalize(items[i].textContent) === "ANALYSE") {
        items[i].click();
        return;
      }
    }
  }

  function renderBriefing() {
    var doc = appDocument();
    if (!doc || !doc.body || !doc.head) return;
    var target = doc.querySelector(".briefing");
    if (!target) return;

    ensureBriefingStyles(doc);
    var market = currentPreference();
    var labels = {
      XAUUSD: "GOLD",
      NAS100: "NASDAQ 100",
      EURUSD: "EURUSD",
      BTCUSD: "BITCOIN",
      MARKET: "GESAMTMARKT"
    };

    var view = {
      status: labels[market] + " · WIRD GELADEN",
      ready: false,
      summary: "Die Live-Daten für dein ausgewähltes Daily Briefing werden geladen.",
      stat1Label: "Bias",
      stat1Value: "Wird geladen",
      stat1Class: "",
      stat2Label: "Momentum",
      stat2Value: "Wird geladen",
      stat2Class: "",
      stat3Label: "Zeitrahmen",
      stat3Value: "M15",
      stat3Class: "",
      focus: "Sobald die Marktdaten verfügbar sind, wird das Briefing automatisch aktualisiert."
    };

    if (market === "XAUUSD") {
      var goldChange = state.movers.XAUUSD;
      var zones = state.zones;
      if (goldChange != null || zones) {
        var goldDirection = goldChange != null ? direction(goldChange) : { label: "Wird geladen", className: "" };
        view.status = "GOLD · M15 LIVE";
        view.ready = !!(goldChange != null && zones);
        view.stat1Label = "Gold-Bias";
        view.stat1Value = goldDirection.label;
        view.stat1Class = goldDirection.className;
        view.stat2Label = "Momentum";
        view.stat2Value = goldChange != null ? momentumLabel(goldChange) : "Wird geladen";
        view.stat2Class = goldDirection.className;
        view.stat3Label = "Nächstes Level";
        view.stat3Value = "—";
        view.summary = "Gold";
        if (zones) view.summary += " steht aktuell bei " + formatPrice(zones.current);
        if (goldChange != null) view.summary += (zones ? " und" : "") + " bewegt sich im M15 um " + formatPercent(goldChange);
        view.summary += ".";

        if (zones) {
          if (zones.current > zones.r1) {
            view.stat1Value = "Bullisch";
            view.stat1Class = "pos";
            view.stat3Value = formatPrice(zones.r2);
            view.focus = "Gold notiert über Widerstand 1. Der nächste technische Zielbereich liegt bei " + formatPrice(zones.r2) + ".";
          } else if (zones.current < zones.s1) {
            view.stat1Value = "Bärisch";
            view.stat1Class = "neg";
            view.stat3Value = formatPrice(zones.s2);
            view.focus = "Gold handelt unter Unterstützung 1. Die nächste technische Zielzone liegt bei " + formatPrice(zones.s2) + ".";
          } else if (goldChange != null && goldChange >= 0) {
            view.stat3Value = formatPrice(zones.r1);
            view.focus = "Gold handelt innerhalb der Range. Bei weiter positivem Momentum ist Widerstand 1 bei " + formatPrice(zones.r1) + " entscheidend.";
          } else {
            view.stat3Value = formatPrice(zones.s1);
            view.focus = "Gold handelt innerhalb der Range. Bei weiter negativem Momentum ist Unterstützung 1 bei " + formatPrice(zones.s1) + " entscheidend.";
          }
        }
      }
    } else if (market === "MARKET") {
      var keys = Object.keys(state.movers);
      if (keys.length) {
        var positives = keys.filter(function (key) { return state.movers[key] > 0; }).length;
        var strongest = keys[0];
        for (var i = 1; i < keys.length; i++) {
          if (Math.abs(state.movers[keys[i]]) > Math.abs(state.movers[strongest])) strongest = keys[i];
        }
        var average = keys.reduce(function (sum, key) { return sum + state.movers[key]; }, 0) / keys.length;
        var marketDirection = direction(average);
        view.status = keys.length === 4 ? "GESAMTMARKT · LIVE" : "GESAMTMARKT · " + keys.length + "/4";
        view.ready = keys.length === 4;
        view.summary = positives + " von " + keys.length + " geladenen Märkten handeln positiv. " + strongest + " zeigt mit " + formatPercent(state.movers[strongest]) + " die stärkste M15-Bewegung.";
        view.stat1Label = "Markt-Bias";
        view.stat1Value = marketDirection.label;
        view.stat1Class = marketDirection.className;
        view.stat2Label = "Stärkster Markt";
        view.stat2Value = strongest;
        view.stat2Class = state.movers[strongest] >= 0 ? "pos" : "neg";
        view.stat3Label = "Geladen";
        view.stat3Value = keys.length + "/4";
        view.stat3Class = keys.length === 4 ? "pos" : "";
        view.focus = "Der Gesamtmarkt-Modus vergleicht Gold, NAS100, EURUSD und BTCUSD anhand ihrer aktuellen M15-Bewegung.";
      }
    } else {
      var change = state.movers[market];
      if (change != null) {
        var selectedDirection = direction(change);
        view.status = labels[market] + " · M15 LIVE";
        view.ready = true;
        view.summary = labels[market] + " bewegt sich im aktuellen M15-Vergleich um " + formatPercent(change) + ".";
        view.stat1Label = "Bias";
        view.stat1Value = selectedDirection.label;
        view.stat1Class = selectedDirection.className;
        view.stat2Label = "Momentum";
        view.stat2Value = momentumLabel(change);
        view.stat2Class = selectedDirection.className;
        view.stat3Label = "M15 Änderung";
        view.stat3Value = formatPercent(change);
        view.stat3Class = selectedDirection.className;
        view.focus = "Das Briefing bewertet die kurzfristige M15-Bewegung von " + labels[market] + ". Weitere Preiszonen werden für diesen Markt später ergänzt.";
      }
    }

    target.innerHTML = [
      "<div class='tl-cb'>",
      "<div class='tl-cb-head'><div><div class='tl-cb-title'>AI DAILY BRIEFING · " + labels[market] + "</div><div class='tl-cb-date'>" + germanDate() + "</div></div><span class='tl-cb-status " + (view.ready ? "" : "wait") + "'>" + view.status + "</span></div>",
      "<div class='tl-cb-summary'>" + view.summary + "</div>",
      "<div class='tl-cb-grid'>",
      "<div class='tl-cb-stat'><small>" + view.stat1Label + "</small><strong class='" + view.stat1Class + "'>" + view.stat1Value + "</strong></div>",
      "<div class='tl-cb-stat'><small>" + view.stat2Label + "</small><strong class='" + view.stat2Class + "'>" + view.stat2Value + "</strong></div>",
      "<div class='tl-cb-stat'><small>" + view.stat3Label + "</small><strong class='" + view.stat3Class + "'>" + view.stat3Value + "</strong></div>",
      "</div>",
      "<div class='tl-cb-focus'><b>Technischer Fokus</b><p>" + view.focus + "</p></div>",
      "<button class='tl-cb-button' type='button'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-cb-button");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
  }

  function renderAll() {
    renderMarkets();
    renderBriefing();
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

  function invoke(request) {
    return client.functions.invoke("market-data", {
      body: { symbol: request.symbol, interval: "15min", outputsize: request.outputsize }
    }).then(function (result) {
      if (result.error) throw result.error;
      if (!result.data || result.data.ok !== true) throw new Error((result.data && (result.data.message || result.data.error)) || "invalid_response");
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
        if (index < definition.requests.length) return wait(REQUEST_GAP_MS).then(attempt);
        throw lastError;
      });
    }
    return attempt();
  }

  function storeResult(label, payload, source) {
    var change = calculateChange(payload);
    if (change != null) {
      state.movers[label] = change;
      state.sources[label] = source;
    }

    if (label === "XAUUSD") {
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
    }
  }

  function runCycle() {
    if (busy) return Promise.resolve();
    busy = true;
    var chain = Promise.resolve();

    DEFINITIONS.forEach(function (definition, position) {
      chain = chain.then(function () {
        if (position > 0) return wait(REQUEST_GAP_MS);
      }).then(function () {
        return invokeDefinition(definition);
      }).then(function (result) {
        storeResult(definition.label, result.payload, result.source);
        renderAll();
      }).catch(function () {
        return null;
      });
    });

    return chain.then(function () {
      state.lastRefreshAt = Date.now();
      busy = false;
      renderAll();
    }).catch(function () {
      busy = false;
      renderAll();
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
    renderTimer = setInterval(renderAll, 1000);
    setTimeout(function () {
      clearInterval(renderTimer);
      renderTimer = setInterval(renderAll, 5000);
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

    renderAll();
    runCycle().then(function () {
      startRenderGuard();
      scheduleNextRefresh();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.lastRefreshAt && Date.now() - state.lastRefreshAt > M15_MS + 60000) {
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
