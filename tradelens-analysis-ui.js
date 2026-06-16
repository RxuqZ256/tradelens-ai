(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var uiClient = null;

  function addStyles() {
    if (document.getElementById("tl-analysis-ui-style")) return;
    var s = document.createElement("style");
    s.id = "tl-analysis-ui-style";
    s.textContent =
      ".tl-native-input{width:100%;border:0!important;outline:0!important;background:transparent!important;color:inherit!important;font:inherit!important;text-align:inherit!important;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none}"+
      ".tl-settings-state{margin:10px 4px 0;text-align:right;color:#75849d;font:700 11px Rajdhani,Saira,sans-serif}.tl-settings-state.ok{color:#42e8a4}.tl-settings-state.err{color:#fda4af}"+
      ".tl-analysis-error{position:fixed;left:16px;right:16px;bottom:94px;z-index:100000;max-width:520px;margin:auto;padding:15px 44px 15px 16px;border-radius:16px;border:1px solid rgba(248,113,113,.55);background:linear-gradient(145deg,rgba(55,13,27,.98),rgba(12,8,22,.98));box-shadow:0 16px 50px rgba(0,0,0,.46);color:#fff;transform:translateY(24px);opacity:0;pointer-events:none;transition:.22s ease}.tl-analysis-error.on{transform:translateY(0);opacity:1;pointer-events:auto}.tl-analysis-error strong{display:block;margin-bottom:5px;color:#fecdd3;font:800 14px Saira,sans-serif}.tl-analysis-error p{margin:0;color:#e2e8f0;font:600 13px/1.45 Rajdhani,Saira,sans-serif}.tl-analysis-error small{display:block;margin-top:7px;color:#94a3b8;font:500 11px Rajdhani,Saira,sans-serif}.tl-analysis-error button{position:absolute;right:10px;top:9px;width:30px;height:30px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:18px}";
    document.head.appendChild(s);
  }

  function normalize(v) {
    return String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function exactText(root, text) {
    var wanted = normalize(text);
    var nodes = root.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length === 0 && normalize(nodes[i].textContent) === wanted) return nodes[i];
    }
    return null;
  }

  function findRow(page, labelText) {
    var label = exactText(page, labelText);
    if (!label) return null;
    var labels = ["kontogröße", "risiko pro trade", "risiko-betrag", "lotgröße automatisch berechnen"];
    var node = label.parentElement;
    while (node && node !== page) {
      var text = normalize(node.textContent);
      var others = 0;
      for (var i = 0; i < labels.length; i++) {
        if (labels[i] !== normalize(labelText) && text.indexOf(labels[i]) >= 0) others++;
      }
      if (others === 0) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findValueLeaf(row, labelText) {
    var label = exactText(row, labelText);
    var leaves = row.querySelectorAll("*");
    for (var i = leaves.length - 1; i >= 0; i--) {
      var el = leaves[i];
      if (el === label || el.children.length) continue;
      var t = normalize(el.textContent);
      if (!t) continue;
      if (t === normalize(labelText)) continue;
      if (t === "nicht gesetzt" || t === "—" || t === "-" || /%$/.test(t) || /[€$£]|\beur\b|\busd\b|\bgbp\b|\bchf\b/i.test(t)) return el;
    }
    return null;
  }

  function createClient() {
    if (uiClient) return uiClient;
    if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return null;
    uiClient = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" }
    });
    return uiClient;
  }

  function money(value, currency) {
    try {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(Number(value) || 0);
    } catch (_e) {
      return (Number(value) || 0).toFixed(2) + " " + (currency || "EUR");
    }
  }

  function enhanceSettings() {
    addStyles();
    var duplicate = document.getElementById("tl-risk-settings");
    if (duplicate) duplicate.remove();

    var page = document.getElementById("page-analyse");
    if (!page || page.getAttribute("data-tl-settings-ready") === "true") return;

    var accountRow = findRow(page, "Kontogröße");
    var riskRow = findRow(page, "Risiko pro Trade");
    var amountRow = findRow(page, "Risiko-Betrag");
    var lotRow = findRow(page, "Lotgröße automatisch berechnen");
    if (!accountRow || !riskRow || !amountRow || !lotRow) return;

    var accountLeaf = findValueLeaf(accountRow, "Kontogröße");
    var riskLeaf = findValueLeaf(riskRow, "Risiko pro Trade");
    var amountLeaf = findValueLeaf(amountRow, "Risiko-Betrag");
    if (!accountLeaf || !riskLeaf || !amountLeaf) return;

    page.setAttribute("data-tl-settings-ready", "true");

    var accountInput = document.createElement("input");
    accountInput.id = "tl-account-size";
    accountInput.className = "tl-native-input";
    accountInput.type = "number";
    accountInput.min = "1";
    accountInput.step = "100";
    accountInput.inputMode = "decimal";
    accountInput.placeholder = "Nicht gesetzt";
    accountLeaf.textContent = "";
    accountLeaf.appendChild(accountInput);

    var riskInput = document.createElement("input");
    riskInput.id = "tl-risk-percent";
    riskInput.className = "tl-native-input";
    riskInput.type = "number";
    riskInput.min = "0.1";
    riskInput.max = "10";
    riskInput.step = "0.1";
    riskInput.inputMode = "decimal";
    riskInput.placeholder = "1";
    riskLeaf.textContent = "";
    riskLeaf.appendChild(riskInput);

    amountLeaf.id = "tl-risk-amount";
    amountLeaf.textContent = "—";

    var state = document.createElement("div");
    state.id = "tl-settings-state";
    state.className = "tl-settings-state";
    state.textContent = "Einstellungen werden geladen …";
    var settingsCard = accountRow.parentElement;
    while (settingsCard && settingsCard !== page && normalize(settingsCard.textContent).indexOf("lotgröße automatisch berechnen") < 0) settingsCard = settingsCard.parentElement;
    (settingsCard && settingsCard !== page ? settingsCard : amountRow.parentElement).appendChild(state);

    var uid = null;
    var currency = "EUR";
    var saveTimer = null;
    var autoLot = true;
    var realToggle = lotRow.querySelector('input[type="checkbox"]');
    if (!realToggle) realToggle = lotRow.querySelector('[role="switch"]');

    function setState(text, type) {
      state.textContent = text;
      state.className = "tl-settings-state" + (type ? " " + type : "");
    }

    function updateAmount() {
      var a = Number(accountInput.value);
      var r = Number(riskInput.value);
      amountLeaf.textContent = a > 0 && r > 0 ? money(a * r / 100, currency) : "—";
    }

    function readToggle() {
      if (!realToggle) return autoLot;
      if (realToggle.matches('input[type="checkbox"]')) return !!realToggle.checked;
      var aria = realToggle.getAttribute("aria-checked");
      return aria == null ? autoLot : aria === "true";
    }

    function saveNow() {
      if (!uid || !window.TLData) return;
      var a = Number(accountInput.value);
      var r = Number(riskInput.value);
      if (!isFinite(a) || a <= 0) { setState("Kontogröße eingeben", "err"); return; }
      if (!isFinite(r) || r < 0.1 || r > 10) { setState("Risiko: 0,1–10 %", "err"); return; }
      setState("Wird gespeichert …", "");
      window.TLData.saveSettings(uid, {
        account_size: a,
        risk_percent: r,
        auto_lot_calculation: readToggle()
      }).then(function (res) {
        setState(res && res.ok ? "Automatisch gespeichert ✓" : "Speichern fehlgeschlagen", res && res.ok ? "ok" : "err");
      }).catch(function () { setState("Speichern fehlgeschlagen", "err"); });
    }

    function scheduleSave() {
      updateAmount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 600);
    }

    accountInput.addEventListener("input", scheduleSave);
    riskInput.addEventListener("input", scheduleSave);
    lotRow.addEventListener("click", function () {
      setTimeout(function () { autoLot = readToggle(); scheduleSave(); }, 50);
    });

    if (!window.TLData) { setState("Einstellungen nicht verfügbar", "err"); return; }
    window.TLData.currentUser().then(function (user) {
      if (!user) { setState("Bitte neu anmelden", "err"); return null; }
      uid = user.id;
      return window.TLData.loadSettings(uid);
    }).then(function (res) {
      if (!res) return;
      if (res.ok && res.data) {
        currency = res.data.account_currency || "EUR";
        accountInput.value = res.data.account_size || "";
        riskInput.value = res.data.risk_percent != null ? Number(res.data.risk_percent) : 1;
        autoLot = res.data.auto_lot_calculation !== false;
        if (realToggle && realToggle.matches('input[type="checkbox"]')) realToggle.checked = autoLot;
        if (realToggle && realToggle.getAttribute("role") === "switch") realToggle.setAttribute("aria-checked", autoLot ? "true" : "false");
        updateAmount();
        setState(accountInput.value ? "Gespeichert ✓" : "Kontogröße eingeben", accountInput.value ? "ok" : "");
      }
    }).catch(function () { setState("Einstellungen konnten nicht geladen werden", "err"); });
  }

  var ERROR_TEXT = {
    unauthorized: "Keine aktive Anmeldung gefunden. Bitte melde dich erneut an.",
    invalid_request: "Die Anfrage war ungültig. Lade den Chart bitte neu hoch.",
    upload_not_found: "Der Chart wurde nicht gefunden. Lade ihn bitte erneut hoch.",
    rate_limited: "Dein tägliches Analyselimit ist erreicht.",
    model_not_configured: "Die KI ist serverseitig noch nicht vollständig eingerichtet.",
    storage_error: "Der Chart konnte nicht aus dem Speicher geladen werden.",
    provider_error: "Der KI-Dienst hat die Analyse abgelehnt oder war nicht erreichbar.",
    provider_timeout: "Die Analyse hat zu lange gedauert.",
    validation_failed: "Das Analyseergebnis war nicht schlüssig.",
    function_not_deployed: "Die Supabase-Funktion smooth-endpoint ist nicht erreichbar.",
    internal_error: "Bei der Analyse ist ein technischer Fehler aufgetreten."
  };

  function showError(code, detail) {
    addStyles();
    var box = document.getElementById("tl-analysis-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "tl-analysis-error";
      box.className = "tl-analysis-error";
      box.innerHTML = '<button type="button" aria-label="Schließen">×</button><strong>ANALYSE NICHT GESTARTET</strong><p></p><small></small>';
      box.querySelector("button").onclick = function () { box.classList.remove("on"); };
      document.body.appendChild(box);
    }
    box.querySelector("p").textContent = ERROR_TEXT[code] || ERROR_TEXT.internal_error;
    box.querySelector("small").textContent = "Fehlercode: " + code + (detail ? " · " + detail : "");
    box.classList.remove("on");
    requestAnimationFrame(function () { box.classList.add("on"); });
  }

  function inferCode(status, payload) {
    if (status === 404) return "function_not_deployed";
    if (status === 401 || status === 403) return "unauthorized";
    if (status === 429) return "rate_limited";
    if (payload && payload.error_code) return payload.error_code;
    return "internal_error";
  }

  function directAnalyze(uploadId, opts) {
    opts = opts || {};
    var api = window.TLAnalysis || {};
    if (typeof api.showLoading === "function") api.showLoading();
    var c = createClient();
    if (!c) {
      if (typeof api.hideLoading === "function") api.hideLoading();
      showError("model_not_configured", "");
      return Promise.resolve({ ok: false, error_code: "model_not_configured" });
    }
    return c.auth.getSession().then(function (sessionResult) {
      var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
      if (!token) return { ok: false, error_code: "unauthorized", http_status: 401 };
      var body = { upload_id: uploadId, force_reanalysis: opts.force === true };
      if (opts.confirmed_instrument) body.confirmed_instrument = opts.confirmed_instrument;
      if (opts.confirmed_timeframe) body.confirmed_timeframe = opts.confirmed_timeframe;
      var url = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/smooth-endpoint";
      return fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, apikey: CFG.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (payload) {
          if (resp.ok && payload && payload.ok) {
            return { ok: true, status: payload.status, result: payload.result || null, analysis_id: payload.analysis_id || null, cached: !!payload.cached, http_status: resp.status };
          }
          return { ok: false, error_code: inferCode(resp.status, payload), analysis_id: payload && payload.analysis_id || null, http_status: resp.status };
        });
      });
    }).catch(function () {
      return { ok: false, error_code: "provider_error", http_status: 0 };
    }).then(function (result) {
      if (typeof api.hideLoading === "function") api.hideLoading();
      if (!result || !result.ok) showError(result && result.error_code || "internal_error", result && result.http_status ? "HTTP " + result.http_status : "");
      return result;
    });
  }

  function overrideAnalysis() {
    if (!window.TLAnalysis || window.TLAnalysis.__smoothEndpoint) return;
    window.TLAnalysis.analyze = directAnalyze;
    window.TLAnalysis.__smoothEndpoint = true;
  }

  function boot() {
    enhanceSettings();
    overrideAnalysis();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setTimeout(boot, 2500);
})();
