(function () {
  "use strict";

  var frame = document.getElementById("app");
  var lastSignature = "";
  var fastTimer = null;
  var slowTimer = null;

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

  function appDocument() {
    try {
      if (!frame) return null;
      return frame.contentDocument || (frame.contentWindow && frame.contentWindow.document) || null;
    } catch (_error) {
      return null;
    }
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
    if (doc.getElementById("tl-daily-v3-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-daily-v3-style";
    style.textContent = [
      ".tl-daily-v3{display:flex;flex-direction:column;gap:11px}",
      ".tl-daily-v3-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-daily-v3-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.8px;color:#f8fafc}",
      ".tl-daily-v3-date{font-family:var(--f-body);font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-daily-v3-live{font-family:var(--f-disp);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-daily-v3-summary{font-family:var(--f-body);font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-daily-v3-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-daily-v3-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-daily-v3-stat small{display:block;font-family:var(--f-disp);font-size:8px;letter-spacing:.8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-daily-v3-stat strong{display:block;font-family:var(--f-body);font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".tl-daily-v3-stat strong.pos{color:var(--green-2)}",
      ".tl-daily-v3-stat strong.neg{color:var(--red)}",
      ".tl-daily-v3-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px}",
      ".tl-daily-v3-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-daily-v3-focus p{font-family:var(--f-body);font-size:12px;line-height:1.43;color:var(--txt-2);margin-top:3px}",
      ".tl-daily-v3-button{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;padding:2px 0;cursor:pointer}"
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

  function openAnalysis(doc) {
    var items = doc.querySelectorAll("button,a,[role='button'],.nav-item,.tab");
    for (var i = 0; i < items.length; i++) {
      if (normalize(items[i].textContent) === "ANALYSE") {
        items[i].click();
        return;
      }
    }
  }

  function render() {
    var doc = appDocument();
    if (!doc || !doc.body || !doc.head) return false;

    var target = doc.querySelector(".briefing");
    if (!target) return false;

    ensureStyles(doc);
    var movers = readMovers(doc);
    var zones = readZones(doc);
    var keys = Object.keys(movers);
    var ready = keys.length === 4 &&
      zones["AKTUELLER PREIS"] != null &&
      zones["WIDERSTAND 1"] != null &&
      zones["WIDERSTAND 2"] != null &&
      zones["UNTERSTUTZUNG 1"] != null &&
      zones["UNTERSTUTZUNG 2"] != null;

    if (!ready) return false;

    var signature = JSON.stringify({ movers: movers, zones: zones });
    if (signature === lastSignature && target.getAttribute("data-daily-v3") === "ready") return true;
    lastSignature = signature;

    var values = keys.map(function (key) { return movers[key]; });
    var positives = values.filter(function (value) { return value > 0; }).length;
    var average = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    var strongest = keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (Math.abs(movers[keys[i]]) > Math.abs(movers[strongest])) strongest = keys[i];
    }

    var bias = "Ausgeglichen";
    var biasClass = "";
    if (average > 0.035 && positives >= 3) { bias = "Risk-on"; biasClass = "pos"; }
    else if (average < -0.035 && positives <= 1) { bias = "Defensiv"; biasClass = "neg"; }
    else if (positives >= 3) { bias = "Leicht positiv"; biasClass = "pos"; }
    else if (positives <= 1) { bias = "Leicht negativ"; biasClass = "neg"; }

    var current = zones["AKTUELLER PREIS"];
    var r1 = zones["WIDERSTAND 1"];
    var r2 = zones["WIDERSTAND 2"];
    var s1 = zones["UNTERSTUTZUNG 1"];
    var s2 = zones["UNTERSTUTZUNG 2"];
    var goldLabel = "In der Range";
    var goldClass = "";
    var focus = "Gold bewegt sich zwischen Unterstützung 1 bei " + formatPrice(s1) + " und Widerstand 1 bei " + formatPrice(r1) + ".";

    if (current > r1) {
      goldLabel = "Über R1";
      goldClass = "pos";
      focus = "Gold notiert oberhalb des ersten Widerstands. Der nächste technische Bereich liegt bei " + formatPrice(r2) + ".";
    } else if (current < s1) {
      goldLabel = "Unter S1";
      goldClass = "neg";
      focus = "Gold handelt unterhalb der ersten Unterstützung. Die nächste technische Zone liegt bei " + formatPrice(s2) + ".";
    }

    var summary = positives + " von 4 beobachteten Märkten handeln positiv. " + strongest +
      " zeigt mit " + formatPercent(movers[strongest]) +
      " die stärkste M15-Bewegung. Gold steht aktuell bei " + formatPrice(current) + ".";

    target.setAttribute("data-daily-v3", "ready");
    target.innerHTML = [
      "<div class='tl-daily-v3'>",
      "<div class='tl-daily-v3-head'><div><div class='tl-daily-v3-title'>AI DAILY BRIEFING</div><div class='tl-daily-v3-date'>" + germanDate() + "</div></div><span class='tl-daily-v3-live'>LIVE VERBUNDEN</span></div>",
      "<div class='tl-daily-v3-summary'>" + summary + "</div>",
      "<div class='tl-daily-v3-grid'>",
      "<div class='tl-daily-v3-stat'><small>Markt-Bias</small><strong class='" + biasClass + "'>" + bias + "</strong></div>",
      "<div class='tl-daily-v3-stat'><small>Stärkster Markt</small><strong class='" + (movers[strongest] >= 0 ? "pos" : "neg") + "'>" + strongest + "</strong></div>",
      "<div class='tl-daily-v3-stat'><small>Gold M15</small><strong class='" + goldClass + "'>" + goldLabel + "</strong></div>",
      "</div>",
      "<div class='tl-daily-v3-focus'><b>Technischer Fokus</b><p>" + focus + "</p></div>",
      "<button class='tl-daily-v3-button' type='button'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-daily-v3-button");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
    return true;
  }

  function start() {
    clearInterval(fastTimer);
    clearInterval(slowTimer);

    fastTimer = setInterval(function () {
      if (render()) {
        clearInterval(fastTimer);
        slowTimer = setInterval(render, 5000);
      }
    }, 500);

    setTimeout(function () {
      if (fastTimer) {
        clearInterval(fastTimer);
        fastTimer = null;
      }
      if (!slowTimer) slowTimer = setInterval(render, 5000);
    }, 60000);
  }

  start();
})();
