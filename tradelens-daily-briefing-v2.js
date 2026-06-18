(function () {
  "use strict";

  var frame = document.getElementById("app");
  var pollTimer = null;
  var lastSignature = "";

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function appDocument() {
    try {
      return frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document));
    } catch (_error) {
      return null;
    }
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

  function textLeaves(doc) {
    var nodes = doc.querySelectorAll("*");
    var leaves = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length === 0 && normalize(nodes[i].textContent)) leaves.push(nodes[i]);
    }
    return leaves;
  }

  function findBriefingTarget(doc) {
    var existing = doc.querySelector("[data-tl-daily-briefing-target]");
    if (existing) return existing;

    var leaves = textLeaves(doc);
    var trigger = null;
    for (var i = 0; i < leaves.length; i++) {
      var text = normalize(leaves[i].textContent);
      if (text === "AI DAILY BRIEFING" || text === "DAILY BRIEFING" || text === "ANALYSE STARTEN") {
        trigger = leaves[i];
        if (text === "AI DAILY BRIEFING") break;
      }
    }
    if (!trigger) return null;

    var card = trigger.closest ? trigger.closest(".gf,.card") : null;
    if (!card) return null;
    var target = card.querySelector(".in") || card;
    target.setAttribute("data-tl-daily-briefing-target", "true");
    return target;
  }

  function injectStyles(doc) {
    if (doc.getElementById("tl-daily-briefing-v2-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-daily-briefing-v2-style";
    style.textContent = [
      ".tl-db2{display:flex;flex-direction:column;gap:11px}",
      ".tl-db2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-db2-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.8px;color:#f8fafc}",
      ".tl-db2-date{font-family:var(--f-body);font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-db2-live{font-family:var(--f-disp);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-db2-summary{font-family:var(--f-body);font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-db2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-db2-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-db2-stat-label{font-family:var(--f-disp);font-size:8px;letter-spacing:.9px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-db2-stat-value{font-family:var(--f-body);font-size:12px;font-weight:700;color:#f8fafc;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".tl-db2-stat-value.pos{color:var(--green-2)}",
      ".tl-db2-stat-value.neg{color:var(--red)}",
      ".tl-db2-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px;border-radius:0 9px 9px 0}",
      ".tl-db2-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-db2-focus p{font-family:var(--f-body);font-size:12px;line-height:1.43;color:var(--txt-2);margin-top:3px}",
      ".tl-db2-cta{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;letter-spacing:.5px;padding:2px 0;cursor:pointer}",
      ".tl-db2-loading{font-family:var(--f-body);font-size:13px;color:var(--txt-2);padding:10px 0}"
    ].join("\n");
    doc.head.appendChild(style);
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

  function germanDate() {
    try {
      return new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(new Date());
    } catch (_error) {
      return "Heute";
    }
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

  function marketAssessment(movers) {
    var keys = Object.keys(movers);
    var values = keys.map(function (key) { return movers[key]; });
    var positives = values.filter(function (value) { return value > 0; }).length;
    var average = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    var strongest = keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (Math.abs(movers[keys[i]]) > Math.abs(movers[strongest])) strongest = keys[i];
    }

    var label = "Ausgeglichen";
    var className = "";
    if (average > 0.035 && positives >= 3) { label = "Risk-on"; className = "pos"; }
    else if (average < -0.035 && positives <= 1) { label = "Defensiv"; className = "neg"; }
    else if (positives >= 3) { label = "Leicht positiv"; className = "pos"; }
    else if (positives <= 1) { label = "Leicht negativ"; className = "neg"; }

    return {
      positives: positives,
      label: label,
      className: className,
      strongest: strongest,
      strongestValue: movers[strongest]
    };
  }

  function goldAssessment(zones) {
    var current = zones["AKTUELLER PREIS"];
    var r1 = zones["WIDERSTAND 1"];
    var r2 = zones["WIDERSTAND 2"];
    var s1 = zones["UNTERSTUTZUNG 1"];
    var s2 = zones["UNTERSTUTZUNG 2"];

    if (current > r1) return {
      label: "Über R1",
      className: "pos",
      text: "Gold notiert oberhalb des ersten Widerstands. Der nächste technische Bereich liegt bei " + formatPrice(r2) + "."
    };
    if (current < s1) return {
      label: "Unter S1",
      className: "neg",
      text: "Gold handelt unterhalb der ersten Unterstützung. Die nächste technische Zone liegt bei " + formatPrice(s2) + "."
    };
    return {
      label: "In der Range",
      className: "",
      text: "Gold bewegt sich zwischen Unterstützung 1 bei " + formatPrice(s1) + " und Widerstand 1 bei " + formatPrice(r1) + "."
    };
  }

  function openAnalysis(doc) {
    var candidates = doc.querySelectorAll("button,a,[role='button'],.nav-item,.tab");
    for (var i = 0; i < candidates.length; i++) {
      if (normalize(candidates[i].textContent) === "ANALYSE") {
        candidates[i].click();
        return;
      }
    }
  }

  function render() {
    var doc = appDocument();
    if (!doc || !doc.body || !doc.head) return;
    var target = findBriefingTarget(doc);
    if (!target) return;
    injectStyles(doc);

    var movers = readMovers(doc);
    var zones = readZones(doc);
    var ready = Object.keys(movers).length >= 4 &&
      zones["AKTUELLER PREIS"] != null &&
      zones["WIDERSTAND 1"] != null &&
      zones["WIDERSTAND 2"] != null &&
      zones["UNTERSTUTZUNG 1"] != null &&
      zones["UNTERSTUTZUNG 2"] != null;

    if (!ready) {
      if (target.getAttribute("data-tl-daily-state") !== "loading") {
        target.setAttribute("data-tl-daily-state", "loading");
        target.innerHTML = [
          "<div class='tl-db2'>",
          "<div class='tl-db2-head'><div><div class='tl-db2-title'>AI DAILY BRIEFING</div><div class='tl-db2-date'>" + germanDate() + "</div></div><span class='tl-db2-live'>M15 LIVE</span></div>",
          "<div class='tl-db2-loading'>Echte Marktdaten werden ausgewertet …</div>",
          "</div>"
        ].join("");
      }
      return;
    }

    var signature = JSON.stringify({ movers: movers, zones: zones });
    if (signature === lastSignature && target.getAttribute("data-tl-daily-state") === "ready") return;
    lastSignature = signature;

    var market = marketAssessment(movers);
    var gold = goldAssessment(zones);
    var summary = market.positives + " von 4 beobachteten Märkten handeln positiv. " +
      market.strongest + " zeigt mit " + formatPercent(market.strongestValue) +
      " die stärkste M15-Bewegung. Gold steht aktuell bei " + formatPrice(zones["AKTUELLER PREIS"]) + ".";

    target.setAttribute("data-tl-daily-state", "ready");
    target.innerHTML = [
      "<div class='tl-db2'>",
      "<div class='tl-db2-head'>",
      "<div><div class='tl-db2-title'>AI DAILY BRIEFING</div><div class='tl-db2-date'>" + germanDate() + "</div></div>",
      "<span class='tl-db2-live'>LIVE VERBUNDEN</span>",
      "</div>",
      "<div class='tl-db2-summary'>" + summary + "</div>",
      "<div class='tl-db2-grid'>",
      "<div class='tl-db2-stat'><div class='tl-db2-stat-label'>Markt-Bias</div><div class='tl-db2-stat-value " + market.className + "'>" + market.label + "</div></div>",
      "<div class='tl-db2-stat'><div class='tl-db2-stat-label'>Stärkster Markt</div><div class='tl-db2-stat-value " + (market.strongestValue >= 0 ? "pos" : "neg") + "'>" + market.strongest + "</div></div>",
      "<div class='tl-db2-stat'><div class='tl-db2-stat-label'>Gold M15</div><div class='tl-db2-stat-value " + gold.className + "'>" + gold.label + "</div></div>",
      "</div>",
      "<div class='tl-db2-focus'><b>Technischer Fokus</b><p>" + gold.text + "</p></div>",
      "<button type='button' class='tl-db2-cta'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-db2-cta");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
  }

  function boot() {
    render();
    clearInterval(pollTimer);
    pollTimer = setInterval(render, 1500);
    setTimeout(function () {
      clearInterval(pollTimer);
      pollTimer = setInterval(render, 5000);
    }, 30000);
  }

  function start() {
    if (!frame) return;
    var doc = appDocument();
    if (doc && (doc.readyState === "interactive" || doc.readyState === "complete")) {
      setTimeout(boot, 200);
    } else {
      frame.addEventListener("load", function () { setTimeout(boot, 200); }, { once: true });
    }
  }

  start();
})();
