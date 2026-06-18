(function () {
  "use strict";

  var frame = document.getElementById("app");
  var lastSignature = "";
  var pollTimer = null;

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  function parseGermanNumber(value) {
    var text = String(value || "")
      .replace(/%/g, "")
      .replace(/\s/g, "")
      .replace(/[^0-9,+\-.]/g, "");

    if (!text || text === "-" || text === "—") return null;
    if (text.indexOf(",") >= 0) {
      text = text.replace(/\./g, "").replace(",", ".");
    }
    var number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function appDocument() {
    return frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document));
  }

  function readMovers(doc) {
    var result = {};
    var rows = doc.querySelectorAll(".mover");
    for (var i = 0; i < rows.length; i++) {
      var symbol = rows[i].querySelector(".sym");
      var value = rows[i].querySelector(".pct");
      if (!symbol || !value) continue;
      var label = normalize(symbol.textContent);
      var parsed = parseGermanNumber(value.textContent);
      if (label && parsed != null) result[label] = parsed;
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
      var key = normalize(label.textContent);
      var parsed = parseGermanNumber(value.textContent);
      if (key && parsed != null) result[key] = parsed;
    }
    return result;
  }

  function findBriefingTarget(doc) {
    var direct = doc.querySelector(".briefing");
    if (direct) return direct;

    var nodes = doc.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length !== 0) continue;
      var text = normalize(nodes[i].textContent);
      if (text.indexOf("ANALYSE STARTEN") >= 0 || text.indexOf("DAILY BRIEFING") >= 0) {
        var card = nodes[i].closest ? nodes[i].closest(".gf,.card") : null;
        if (card) return card.querySelector(".in") || card;
      }
    }
    return null;
  }

  function injectStyles(doc) {
    if (doc.getElementById("tl-daily-briefing-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-daily-briefing-style";
    style.textContent = [
      ".tl-db{position:relative;display:flex;flex-direction:column;gap:10px}",
      ".tl-db-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-db-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.7px;color:#f8fafc}",
      ".tl-db-date{font-family:var(--f-body);font-size:11px;color:var(--txt-2);margin-top:2px}",
      ".tl-db-live{font-family:var(--f-disp);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-db-summary{font-family:var(--f-body);font-size:13px;line-height:1.48;color:#dbeafe}",
      ".tl-db-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-db-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-db-stat-label{font-family:var(--f-disp);font-size:8px;letter-spacing:.9px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-db-stat-value{font-family:var(--f-body);font-size:12px;font-weight:700;color:#f8fafc;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".tl-db-stat-value.pos{color:var(--green-2)}",
      ".tl-db-stat-value.neg{color:var(--red)}",
      ".tl-db-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px;border-radius:0 9px 9px 0}",
      ".tl-db-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-db-focus p{font-family:var(--f-body);font-size:12px;line-height:1.42;color:var(--txt-2);margin-top:3px}",
      ".tl-db-cta{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;letter-spacing:.5px;padding:2px 0;cursor:pointer}",
      ".tl-db-cta:active{transform:scale(.98)}",
      ".tl-db-loading{font-family:var(--f-body);font-size:13px;color:var(--txt-2);padding:12px 0}"
    ].join("\n");
    doc.head.appendChild(style);
  }

  function germanDate() {
    try {
      return new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long"
      }).format(new Date());
    } catch (_error) {
      return "Heute";
    }
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + value.toFixed(2).replace(".", ",") + "%";
  }

  function formatPrice(value) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function marketAssessment(movers) {
    var keys = Object.keys(movers);
    var values = keys.map(function (key) { return movers[key]; });
    var average = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    var positives = values.filter(function (value) { return value > 0; }).length;

    var label = "Ausgeglichen";
    var className = "";
    if (average > 0.035 && positives >= 3) {
      label = "Risk-on";
      className = "pos";
    } else if (average < -0.035 && positives <= 1) {
      label = "Defensiv";
      className = "neg";
    } else if (positives >= 3) {
      label = "Leicht positiv";
      className = "pos";
    } else if (positives <= 1) {
      label = "Leicht negativ";
      className = "neg";
    }

    var strongestKey = keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (Math.abs(movers[keys[i]]) > Math.abs(movers[strongestKey])) strongestKey = keys[i];
    }

    return {
      label: label,
      className: className,
      average: average,
      positives: positives,
      strongestKey: strongestKey,
      strongestValue: movers[strongestKey]
    };
  }

  function goldAssessment(zones) {
    var current = zones["AKTUELLER PREIS"];
    var r1 = zones["WIDERSTAND 1"];
    var r2 = zones["WIDERSTAND 2"];
    var s1 = zones["UNTERSTUTZUNG 1"];
    var s2 = zones["UNTERSTUTZUNG 2"];

    if (current > r1) {
      return {
        label: "Über R1",
        className: "pos",
        text: "Gold notiert oberhalb des ersten Widerstands. Der nächste technische Bereich liegt bei " + formatPrice(r2) + "."
      };
    }
    if (current < s1) {
      return {
        label: "Unter S1",
        className: "neg",
        text: "Gold handelt unterhalb der ersten Unterstützung. Die nächste technische Zone liegt bei " + formatPrice(s2) + "."
      };
    }
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
    if (!doc || !doc.body) return;
    var target = findBriefingTarget(doc);
    if (!target) return;
    injectStyles(doc);

    var movers = readMovers(doc);
    var zones = readZones(doc);
    var moverCount = Object.keys(movers).length;
    var zoneReady = zones["AKTUELLER PREIS"] != null && zones["WIDERSTAND 1"] != null && zones["UNTERSTUTZUNG 1"] != null;

    if (moverCount < 4 || !zoneReady) {
      if (target.getAttribute("data-tl-daily-state") !== "loading") {
        target.setAttribute("data-tl-daily-state", "loading");
        target.innerHTML = "<div class='tl-db'><div class='tl-db-head'><div><div class='tl-db-title'>DAILY BRIEFING</div><div class='tl-db-date'>" + germanDate() + "</div></div><span class='tl-db-live'>M15 LIVE</span></div><div class='tl-db-loading'>Marktdaten werden ausgewertet …</div></div>";
      }
      return;
    }

    var signature = JSON.stringify({ movers: movers, zones: zones });
    if (signature === lastSignature && target.getAttribute("data-tl-daily-state") === "ready") return;
    lastSignature = signature;

    var market = marketAssessment(movers);
    var gold = goldAssessment(zones);
    var summary = market.positives + " von 4 beobachteten Märkten handeln positiv. " +
      market.strongestKey + " zeigt mit " + formatPercent(market.strongestValue) +
      " aktuell die stärkste M15-Bewegung. Gold steht bei " + formatPrice(zones["AKTUELLER PREIS"]) + ".";

    target.setAttribute("data-tl-daily-state", "ready");
    target.innerHTML = [
      "<div class='tl-db'>",
      "<div class='tl-db-head'>",
      "<div><div class='tl-db-title'>DAILY BRIEFING</div><div class='tl-db-date'>" + germanDate() + "</div></div>",
      "<span class='tl-db-live'>M15 LIVE</span>",
      "</div>",
      "<div class='tl-db-summary'>" + summary + "</div>",
      "<div class='tl-db-grid'>",
      "<div class='tl-db-stat'><div class='tl-db-stat-label'>Markt-Bias</div><div class='tl-db-stat-value " + market.className + "'>" + market.label + "</div></div>",
      "<div class='tl-db-stat'><div class='tl-db-stat-label'>Stärkster Markt</div><div class='tl-db-stat-value " + (market.strongestValue >= 0 ? "pos" : "neg") + "'>" + market.strongestKey + "</div></div>",
      "<div class='tl-db-stat'><div class='tl-db-stat-label'>Gold M15</div><div class='tl-db-stat-value " + gold.className + "'>" + gold.label + "</div></div>",
      "</div>",
      "<div class='tl-db-focus'><b>Technischer Fokus</b><p>" + gold.text + "</p></div>",
      "<button type='button' class='tl-db-cta'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-db-cta");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
  }

  function boot() {
    render();
    clearInterval(pollTimer);
    pollTimer = setInterval(render, 5000);
  }

  if (frame) frame.addEventListener("load", function () { setTimeout(boot, 900); });
})();
