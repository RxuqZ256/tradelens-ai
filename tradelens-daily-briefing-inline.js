(function () {
  "use strict";

  var frame = document.getElementById("app");
  var timer = null;
  var lastSignature = "";

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
      return frame && (frame.contentDocument || frame.contentWindow.document);
    } catch (_error) {
      return null;
    }
  }

  function findTarget(doc) {
    var direct = doc.querySelector(".briefing");
    if (direct) return direct;

    var nodes = doc.querySelectorAll("h1,h2,h3,.label,button,a,div,span");
    for (var i = 0; i < nodes.length; i++) {
      var text = normalize(nodes[i].textContent);
      if (text === "AI DAILY BRIEFING" || text === "DAILY BRIEFING") {
        var card = nodes[i].closest ? nodes[i].closest(".gf,.card") : null;
        if (card) return card.querySelector(".in") || card;
      }
    }
    return null;
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

  function injectStyles(doc) {
    if (doc.getElementById("tl-inline-briefing-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-inline-briefing-style";
    style.textContent = [
      ".tl-live-briefing{display:flex;flex-direction:column;gap:11px}",
      ".tl-live-briefing-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-live-briefing-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.8px;color:#f8fafc}",
      ".tl-live-briefing-date{font-family:var(--f-body);font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-live-briefing-status{font-family:var(--f-disp);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-live-briefing-summary{font-family:var(--f-body);font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-live-briefing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-live-briefing-stat{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-live-briefing-stat small{display:block;font-family:var(--f-disp);font-size:8px;letter-spacing:.8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-live-briefing-stat strong{display:block;font-family:var(--f-body);font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".tl-live-briefing-stat strong.pos{color:var(--green-2)}",
      ".tl-live-briefing-stat strong.neg{color:var(--red)}",
      ".tl-live-briefing-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px}",
      ".tl-live-briefing-focus b{font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase}",
      ".tl-live-briefing-focus p{font-family:var(--f-body);font-size:12px;line-height:1.43;color:var(--txt-2);margin-top:3px}",
      ".tl-live-briefing-button{display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-family:var(--f-disp);font-size:11px;font-weight:700;padding:2px 0;cursor:pointer}"
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
    var target = findTarget(doc);
    if (!target) return;

    var movers = readMovers(doc);
    var zones = readZones(doc);
    var keys = Object.keys(movers);
    var ready = keys.length === 4 &&
      zones["AKTUELLER PREIS"] != null &&
      zones["WIDERSTAND 1"] != null &&
      zones["WIDERSTAND 2"] != null &&
      zones["UNTERSTUTZUNG 1"] != null &&
      zones["UNTERSTUTZUNG 2"] != null;

    injectStyles(doc);

    if (!ready) {
      if (target.getAttribute("data-live-briefing-state") !== "loading") {
        target.setAttribute("data-live-briefing-state", "loading");
        target.innerHTML = "<div class='tl-live-briefing'><div class='tl-live-briefing-head'><div><div class='tl-live-briefing-title'>AI DAILY BRIEFING</div><div class='tl-live-briefing-date'>" + germanDate() + "</div></div><span class='tl-live-briefing-status'>M15 LIVE</span></div><div class='tl-live-briefing-summary'>Echte Marktdaten werden ausgewertet …</div></div>";
      }
      return;
    }

    var signature = JSON.stringify({ movers: movers, zones: zones });
    if (signature === lastSignature && target.getAttribute("data-live-briefing-state") === "ready") return;
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

    target.setAttribute("data-live-briefing-state", "ready");
    target.innerHTML = [
      "<div class='tl-live-briefing'>",
      "<div class='tl-live-briefing-head'><div><div class='tl-live-briefing-title'>AI DAILY BRIEFING</div><div class='tl-live-briefing-date'>" + germanDate() + "</div></div><span class='tl-live-briefing-status'>LIVE VERBUNDEN</span></div>",
      "<div class='tl-live-briefing-summary'>" + summary + "</div>",
      "<div class='tl-live-briefing-grid'>",
      "<div class='tl-live-briefing-stat'><small>Markt-Bias</small><strong class='" + biasClass + "'>" + bias + "</strong></div>",
      "<div class='tl-live-briefing-stat'><small>Stärkster Markt</small><strong class='" + (movers[strongest] >= 0 ? "pos" : "neg") + "'>" + strongest + "</strong></div>",
      "<div class='tl-live-briefing-stat'><small>Gold M15</small><strong class='" + goldClass + "'>" + goldLabel + "</strong></div>",
      "</div>",
      "<div class='tl-live-briefing-focus'><b>Technischer Fokus</b><p>" + focus + "</p></div>",
      "<button class='tl-live-briefing-button' type='button'><span>Analyse starten</span><span>›</span></button>",
      "</div>"
    ].join("");

    var button = target.querySelector(".tl-live-briefing-button");
    if (button) button.addEventListener("click", function () { openAnalysis(doc); });
  }

  function boot() {
    render();
    clearInterval(timer);
    timer = setInterval(render, 1000);
    setTimeout(function () {
      clearInterval(timer);
      timer = setInterval(render, 5000);
    }, 30000);
  }

  if (!frame) return;
  try {
    var doc = appDocument();
    if (doc && doc.readyState !== "loading") {
      setTimeout(boot, 100);
    } else {
      frame.addEventListener("load", function () { setTimeout(boot, 100); }, { once: true });
    }
  } catch (_error) {
    frame.addEventListener("load", function () { setTimeout(boot, 100); }, { once: true });
  }
})();
