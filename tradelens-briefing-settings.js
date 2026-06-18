(function () {
  "use strict";

  var frame = document.getElementById("app");
  var STORAGE_KEY = "tradelens_daily_briefing_market_v1";
  var DEFAULT_VALUE = "XAUUSD";
  var timer = null;

  var OPTIONS = [
    { value: "XAUUSD", label: "Gold (XAUUSD)", note: "Standard: Gold-Bias, Momentum und wichtige Zonen" },
    { value: "NAS100", label: "NASDAQ 100", note: "M15-Momentum des NASDAQ-100-Marktes" },
    { value: "EURUSD", label: "EURUSD", note: "M15-Momentum des Währungspaars" },
    { value: "BTCUSD", label: "Bitcoin", note: "M15-Momentum von BTCUSD" },
    { value: "MARKET", label: "Gesamtmarkt", note: "Vergleicht Gold, NAS100, EURUSD und BTCUSD" }
  ];

  function appWindow() {
    try { return frame && frame.contentWindow ? frame.contentWindow : null; }
    catch (_error) { return null; }
  }

  function appDocument() {
    var win = appWindow();
    try { return win ? win.document : null; }
    catch (_error) { return null; }
  }

  function readPreference() {
    var win = appWindow();
    var value = null;
    try { value = win && win.localStorage ? win.localStorage.getItem(STORAGE_KEY) : null; }
    catch (_error) {}
    if (!OPTIONS.some(function (item) { return item.value === value; })) value = DEFAULT_VALUE;
    return value;
  }

  function savePreference(value) {
    var win = appWindow();
    try {
      if (win && win.localStorage) win.localStorage.setItem(STORAGE_KEY, value);
    } catch (_error) {}

    try {
      if (win && typeof win.CustomEvent === "function") {
        win.dispatchEvent(new win.CustomEvent("tradelens:briefing-preference", {
          detail: { value: value }
        }));
      }
    } catch (_error2) {}
  }

  function normalize(value) {
    var text = String(value || "").toUpperCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
    return text.replace(/\s+/g, " ").trim();
  }

  function findSettingsPage(doc) {
    var knownIds = ["page-profile", "page-profil", "page-settings", "page-einstellungen"];
    for (var i = 0; i < knownIds.length; i++) {
      var known = doc.getElementById(knownIds[i]);
      if (known) return known;
    }

    var pages = doc.querySelectorAll(".page,[data-page],section");
    for (var j = 0; j < pages.length; j++) {
      var text = normalize(pages[j].textContent);
      if (text.indexOf("EINSTELLUNGEN") >= 0 || text.indexOf("PROFIL") >= 0) return pages[j];
    }
    return null;
  }

  function ensureStyles(doc) {
    if (doc.getElementById("tl-briefing-settings-style")) return;
    var style = doc.createElement("style");
    style.id = "tl-briefing-settings-style";
    style.textContent = [
      ".tl-briefing-settings{margin-top:14px;border:1px solid rgba(37,99,235,.48);background:linear-gradient(160deg,rgba(6,18,42,.96),rgba(4,10,24,.96));border-radius:18px;padding:16px;box-shadow:0 0 22px rgba(0,102,255,.08)}",
      ".tl-briefing-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}",
      ".tl-briefing-settings-title{font-family:var(--f-disp);font-size:14px;font-weight:700;letter-spacing:1.5px;color:#dbeafe}",
      ".tl-briefing-settings-sub{font-family:var(--f-body);font-size:11.5px;line-height:1.4;color:var(--txt-2);margin-top:4px}",
      ".tl-briefing-settings-badge{font-family:var(--f-disp);font-size:8px;font-weight:700;letter-spacing:1px;color:var(--cyan);border:1px solid rgba(0,229,255,.3);background:rgba(0,229,255,.07);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-briefing-settings-label{display:block;font-family:var(--f-disp);font-size:9px;letter-spacing:1px;color:var(--txt-3);margin-bottom:6px;text-transform:uppercase}",
      ".tl-briefing-settings-select{width:100%;appearance:none;-webkit-appearance:none;border:1px solid rgba(59,130,246,.42);background:rgba(7,15,35,.92);color:#f8fafc;border-radius:12px;padding:12px 38px 12px 12px;font-family:var(--f-body);font-size:13px;font-weight:600;outline:none}",
      ".tl-briefing-settings-wrap{position:relative}",
      ".tl-briefing-settings-wrap:after{content:'⌄';position:absolute;right:13px;top:50%;transform:translateY(-56%);color:var(--cyan);pointer-events:none;font-size:16px}",
      ".tl-briefing-settings-note{font-family:var(--f-body);font-size:11px;line-height:1.4;color:var(--txt-2);margin-top:8px}",
      ".tl-briefing-settings-saved{font-family:var(--f-disp);font-size:9px;color:var(--green);letter-spacing:.7px;margin-top:9px;opacity:0;transition:opacity .2s}",
      ".tl-briefing-settings-saved.show{opacity:1}"
    ].join("\n");
    doc.head.appendChild(style);
  }

  function optionNote(value) {
    for (var i = 0; i < OPTIONS.length; i++) {
      if (OPTIONS[i].value === value) return OPTIONS[i].note;
    }
    return OPTIONS[0].note;
  }

  function mount() {
    var doc = appDocument();
    if (!doc || !doc.body || !doc.head) return false;
    if (doc.querySelector("[data-tl-briefing-settings]")) return true;

    var page = findSettingsPage(doc);
    if (!page) return false;
    ensureStyles(doc);

    var card = doc.createElement("div");
    card.className = "tl-briefing-settings";
    card.setAttribute("data-tl-briefing-settings", "true");

    var optionsHtml = OPTIONS.map(function (item) {
      return "<option value='" + item.value + "'>" + item.label + "</option>";
    }).join("");

    card.innerHTML = [
      "<div class='tl-briefing-settings-head'>",
      "<div><div class='tl-briefing-settings-title'>DAILY BRIEFING</div><div class='tl-briefing-settings-sub'>Lege fest, welchen Markt dein tägliches Briefing auswertet.</div></div>",
      "<span class='tl-briefing-settings-badge'>PERSONALISIERT</span>",
      "</div>",
      "<label class='tl-briefing-settings-label' for='tl-briefing-market'>Briefing-Markt</label>",
      "<div class='tl-briefing-settings-wrap'><select id='tl-briefing-market' class='tl-briefing-settings-select'>" + optionsHtml + "</select></div>",
      "<div class='tl-briefing-settings-note'></div>",
      "<div class='tl-briefing-settings-saved'>Einstellung gespeichert</div>"
    ].join("");

    var host = page.querySelector(".content,.page-content,.settings-list,.profile-content") || page;
    host.appendChild(card);

    var select = card.querySelector("#tl-briefing-market");
    var note = card.querySelector(".tl-briefing-settings-note");
    var saved = card.querySelector(".tl-briefing-settings-saved");
    select.value = readPreference();
    note.textContent = optionNote(select.value);

    select.addEventListener("change", function () {
      savePreference(select.value);
      note.textContent = optionNote(select.value);
      saved.classList.add("show");
      setTimeout(function () { saved.classList.remove("show"); }, 1600);
    });

    return true;
  }

  function start() {
    if (mount()) return;
    clearInterval(timer);
    timer = setInterval(function () {
      if (mount()) clearInterval(timer);
    }, 1000);
    setTimeout(function () { clearInterval(timer); }, 60000);
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
