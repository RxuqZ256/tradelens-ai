(function () {
  "use strict";

  var frame = document.getElementById("app");
  var STORAGE_KEY = "tradelens_daily_briefing_market_v1";
  var DEFAULT_MARKET = "XAUUSD";
  var fastTimer = null;
  var slowTimer = null;
  var lastSignature = "";

  var LABELS = {
    XAUUSD: "Gold",
    NAS100: "NASDAQ 100",
    EURUSD: "EURUSD",
    BTCUSD: "Bitcoin",
    MARKET: "Gesamtmarkt"
  };

  function appWindow() {
    try { return frame && frame.contentWindow ? frame.contentWindow : null; }
    catch (_error) { return null; }
  }

  function appDocument() {
    var win = appWindow();
    try { return win ? win.document : null; }
    catch (_error) { return null; }
  }

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    var text = String(value || "")
      .replace(/%/g, "")
      .replace(/\s/g, "")
      .replace(/[^0-9,+\-.]/g, "");
    if (!text || text === "-" || text === "—") return null;
    if (text.indexOf(",") >= 0) text = text.replace(/\./g, "").replace(",", ".");
    var number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function preference() {
    var win = appWindow();
    var value = null;
    try { value = win && win.localStorage ? win.localStorage.getItem(STORAGE_KEY) : null; }
    catch (_error) {}
    return LABELS[value] ? value : DEFAULT_MARKET;
  }

  function readMovers(doc) {
    var result = {};
    var rows = doc.querySelectorAll(".mover");
    for (var i = 0; i < rows.length; i++) {
      var symbol = rows[i].querySelector(".sym");
      var value = rows[i].querySelector(".pct");
      if (!symbol || !value) continue;
      var parsed = parseNumber(value.textContent);
      if (parsed != null) result[normalize(symbol.textContent)] = parsed;
    }
    return result;
  }

  function readZones(doc) {
    var result = {};
    var rows = doc.querySelectorAll(".zr");
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector(".lbl");
      var value = rows[i].querySelector(".val");
      if (!label || !value) continue;
      var parsed = parseNumber(value.textContent);
      if (parsed != null) result[normalize(label.textContent)] = parsed;
    }
    return result;
  }

  function ensureStyles(doc) {
    if (doc.getElementById("tl-daily-v5-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-daily-v5-style";
    style.textContent = [
      ".tl-daily-v5{display:flex;flex-direction:column;gap:11px}",
      ".tl-daily-v5-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-daily-v5-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.8px;color:#f8fafc}",
      ".tl-daily-v5-date{font-family:var(--f-body);font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-daily-v5-status{font-family:var(--f-disp);font-size:9px;font-weight:700;letter-spacing:1px;border-radius:999px;padding:5px 8px;white-space:nowrap;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08)}",
      ".tl-daily-v5-status.wait{color:var(--gold);border-color:rgba(255,200,87,.34);background:rgba(255,200,87,.08)}",
      ".tl-daily-v5-summary{font-family:var(--f-body);font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-daily-v5-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-daily-v5-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-daily-v5-stat small{display:block;font-family:var(--f-disp);font-size:8px;letter-spacing:.8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-daily-v5-stat strong{display:block;font-family:var(--f-body);font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f8fafc}",
      ".tl-daily-v5-stat strong.pos{color:var(--green-2)}",
      ".tl-daily-v5-stat strong.neg{color:var(--red)}",
      ".tl-daily-v5-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px}",
      ".tl-daily-v5-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-daily-v5-focus p{font-family:var(--f-body);font-size:12px;line-height:1.43;color:var(--txt-2);margin-top:3px}",
      ".tl-daily-v5-button{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;padding:2px 0;cursor:pointer}"
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

  function formatPercent(value) {
    return (value > 0 ? "+" : "") + value.toFixed(2).replace(".", ",") + "%";
  }

  function formatPrice(value) {
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function momentum(value) {
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

  function goldView(movers, zones) {
    var change = movers.XAUUSD;
    var current = zones["AKTUELLER PREIS"];
    var r1 = zones["WIDERSTAND 1"];
    var r2 = zones["WIDERSTAND 2"];
    var s1 = zones["UNTERSTUTZUNG 1"];
    var s2 = zones["UNTERSTUTZUNG 2"];
    var zoneReady = current != null && r1 != null && r2 != null && s1 != null && s2 != null;
    var moverReady = change != null;
    var ready = zoneReady || moverReady;

    if (!ready) return null;

    var bias = moverReady ? direction(change) : { label: "Wird geladen", className: "" };
    var position = "Zonen werden geladen";
    var nextLevel = "—";
    var focus = "Die technischen Gold-Zonen werden noch geladen.";

    if (zoneReady) {
      position = "In der Range";
      if (current > r1) position = "Über R1";
      else if (current < s1) position = "Unter S1";

      if (current > r1) {
        bias = { label: "Bullisch", className: "pos" };
        nextLevel = formatPrice(r2);
        focus = "Gold notiert über Widerstand 1. Der nächste technische Zielbereich liegt bei " + formatPrice(r2) + ".";
      } else if (current < s1) {
        bias = { label: "Bärisch", className: "neg" };
        nextLevel = formatPrice(s2);
        focus = "Gold handelt unter Unterstützung 1. Die nächste technische Zielzone liegt bei " + formatPrice(s2) + ".";
      } else if (moverReady && change >= 0) {
        nextLevel = formatPrice(r1);
        focus = "Gold handelt innerhalb der Range. Bei weiter positivem Momentum ist Widerstand 1 bei " + formatPrice(r1) + " entscheidend.";
      } else {
        nextLevel = formatPrice(s1);
        focus = "Gold handelt innerhalb der Range. Bei weiter negativem Momentum ist Unterstützung 1 bei " + formatPrice(s1) + " entscheidend.";
      }
    }

    var summary = "Gold";
    if (zoneReady) summary += " steht aktuell bei " + formatPrice(current);
    if (moverReady) summary += (zoneReady ? " und" : "") + " bewegt sich im M15 um " + formatPercent(change);
    summary += ".";

    return {
      status: "GOLD · M15 LIVE",
      summary: summary,
      stat1Label: "Gold-Bias",
      stat1Value: bias.label,
      stat1Class: bias.className,
      stat2Label: "Momentum",
      stat2Value: moverReady ? momentum(change) : "Wird geladen",
      stat2Class: moverReady ? direction(change).className : "",
      stat3Label: "Nächstes Level",
      stat3Value: nextLevel,
      stat3Class: "",
      focus: focus,
      ready: zoneReady && moverReady
    };
  }

  function singleMarketView(market, movers) {
    var change = movers[market];
    if (change == null) return null;
    var bias = direction(change);
    var label = LABELS[market];
    return {
      status: label.toUpperCase() + " · M15 LIVE",
      summary: label + " bewegt sich im aktuellen M15-Vergleich um " + formatPercent(change) + ".",
      stat1Label: "Bias",
      stat1Value: bias.label,
      stat1Class: bias.className,
      stat2Label: "Momentum",
      stat2Value: momentum(change),
      stat2Class: bias.className,
      stat3Label: "M15 Änderung",
      stat3Value: formatPercent(change),
      stat3Class: bias.className,
      focus: "Das Briefing bewertet aktuell die kurzfristige M15-Bewegung von " + label + ". Weitere Preiszonen werden für diesen Markt später ergänzt.",
      ready: true
    };
  }

  function marketView(movers) {
    var keys = Object.keys(movers);
    if (!keys.length) return null;
    var values = keys.map(function (key) { return movers[key]; });
    var positives = values.filter(function (value) { return value > 0; }).length;
    var average = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    var strongest = keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (Math.abs(movers[keys[i]]) > Math.abs(movers[strongest])) strongest = keys[i];
    }

    var bias = "Ausgeglichen";
    var biasClass = "";
    if (average > 0.035 && positives >= Math.ceil(keys.length * 0.75)) { bias = "Risk-on"; biasClass = "pos"; }
    else if (average < -0.035 && positives <= Math.floor(keys.length * 0.25)) { bias = "Defensiv"; biasClass = "neg"; }
    else if (positives > keys.length / 2) { bias = "Leicht positiv"; biasClass = "pos"; }
    else if (positives < keys.length / 2) { bias = "Leicht negativ"; biasClass = "neg"; }

    return {
      status: keys.length === 4 ? "GESAMTMARKT · LIVE" : "GESAMTMARKT · " + keys.length + "/4",
      summary: positives + " von " + keys.length + " geladenen Märkten handeln positiv. " + strongest + " zeigt mit " + formatPercent(movers[strongest]) + " die stärkste M15-Bewegung.",
      stat1Label: "Markt-Bias",
      stat1Value: bias,
      stat1Class: biasClass,
      stat2Label: "Stärkster Markt",
      stat2Value: strongest,
      stat2Class: movers[strongest] >= 0 ? "pos" : "neg",
      stat3Label: "Geladen",
      stat3Value: keys.length + "/4",
      stat3Class: keys.length === 4 ? "pos" : "",
      focus: "Der Gesamtmarkt-Modus vergleicht Gold, NAS100, EURUSD und BTCUSD auf Basis ihrer aktuellen M15-Bewegung.",
      ready: keys.length === 4
    };
  }

  function loadingView(market) {
    return {
      status: LABELS[market].toUpperCase() + " · WIRD GELADEN",
      summary: "Die Live-Daten für dein ausgewähltes Daily Briefing werden gerade geladen.",
      stat1Label: "Bias",
      stat1Value: "Wird geladen",
      stat1Class: "",
      stat2Label: "Momentum",
      stat2Value: "Wird geladen",
      stat2Class: "",
      stat3Label: "Zeitrahmen",
      stat3Value: "M15",
      stat3Class: "",
      focus: "Sobald die Marktdaten verfügbar sind, wird das Briefing automatisch aktualisiert.",
      ready: false
    };
  }

  function render() {
    var doc = appDocument();
    if (!doc || !doc.body || !doc.head) return false;
    var target = doc.querySelector(".briefing");
    if (!target) return false;

    ensureStyles(doc);
    var selected = preference();
    var movers = readMovers(doc);
    var zones = readZones(doc);
    var view = null;

    if (selected === "XAUUSD") view = goldView(movers, zones);
    else if (selected === "MARKET") view = marketView(movers);
    else view = singleMarketView(selected, movers);
    if (!view) view = loadingView(selected);

    var signature = JSON.stringify({ selected: selected, movers: movers, zones: zones, view: view });
    if (signature === lastSignature && target.getAttribute("data-daily-v5") === "ready") return true;
    lastSignature = signature;

    target.setAttribute("data-daily-v5", "ready");
    target.innerHTML = [
      "<div class='tl-daily-v5'>",
      "<div class='tl-daily-v5-head'><div><div class='tl-daily-v5-title'>AI DAILY BRIEFING · " + LABELS[selected].toUpperCase() + "</div><div class='tl-daily-v5-date'>" + germanDate() + "</div></div><span class='tl-daily-v5-status " + (view.ready ? "" : "wait") + "'>" + view.status + "</span></div>",
      "<div class='tl-daily-v5-summary'>" + view.summary + "</div>",
      "<div class='tl-daily-v5-grid'>",
      "<div class='tl-daily-v5-stat'><small>" + view.stat1Label + "</small><strong class='" + view.stat1Class + "'>" + view.stat1Value + "</strong></div>",
      "<div class='tl-daily-v5-stat'><small>" + view.stat2Label + "</small><strong class='" + view.stat2Class + "'>" + view.stat2Value + "</strong></div>",
      "<div class='tl-daily-v5-stat'><small>" + view.stat3Label + "</small><strong class='" + view.stat3Class + "'>" + view.stat3Value + "</strong></div>",
      "</div>",
      "<div class='tl-daily-v5-focus'><b>Technischer Fokus</b><p>" + view.focus + "</p></div>",
      "<button class='tl-daily-v5-button' type='button'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-daily-v5-button");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
    return true;
  }

  function start() {
    render();
    clearInterval(fastTimer);
    clearInterval(slowTimer);
    fastTimer = setInterval(render, 750);
    setTimeout(function () {
      clearInterval(fastTimer);
      slowTimer = setInterval(render, 5000);
    }, 60000);
  }

  if (!frame) return;
  try {
    var doc = appDocument();
    if (doc && doc.readyState !== "loading") start();
    else frame.addEventListener("load", start, { once: true });
  } catch (_error) {
    frame.addEventListener("load", start, { once: true });
  }
})();
