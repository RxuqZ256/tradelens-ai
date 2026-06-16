(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var uiClient = null;

  function addStyles() {
    if (document.getElementById("tl-analysis-ui-style")) return;
    var s = document.createElement("style");
    s.id = "tl-analysis-ui-style";
    s.textContent =
      ".tl-setting-row{display:flex!important;align-items:center!important;gap:12px!important}"+
      ".tl-inline-control{margin-left:auto;flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;min-width:150px;height:54px;padding:0 14px;border:1px solid rgba(0,229,255,.38);border-radius:15px;background:rgba(2,9,25,.78);box-shadow:inset 0 0 18px rgba(0,229,255,.035)}"+
      ".tl-inline-control:focus-within{border-color:#00dff4;box-shadow:0 0 0 3px rgba(0,223,244,.09),inset 0 0 18px rgba(0,229,255,.05)}"+
      ".tl-inline-control input{width:112px;min-width:0;border:0;outline:0;background:transparent;color:#fff;text-align:right;font:700 17px Saira,system-ui,sans-serif;-webkit-appearance:none;appearance:none}"+
      ".tl-inline-control b{margin-left:6px;color:#7dd3fc;font:800 14px Rajdhani,Saira,sans-serif}"+
      ".tl-inline-output{margin-left:auto;min-width:150px;text-align:right;color:#7c8cff;font:800 18px Saira,system-ui,sans-serif}"+
      ".tl-inline-switch{margin-left:auto;position:relative;width:76px;height:42px;flex:0 0 76px}"+
      ".tl-inline-switch input{position:absolute;opacity:0;width:1px;height:1px}"+
      ".tl-inline-switch span{position:absolute;inset:0;border-radius:999px;background:#27334d;border:1px solid rgba(148,163,184,.25);box-shadow:inset 0 2px 8px rgba(0,0,0,.35);transition:.2s}"+
      ".tl-inline-switch span:after{content:'';position:absolute;width:32px;height:32px;left:4px;top:4px;border-radius:50%;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.35);transition:.2s}"+
      ".tl-inline-switch input:checked+span{background:linear-gradient(90deg,#08bce7,#337bff);box-shadow:0 0 22px rgba(0,199,255,.4)}"+
      ".tl-inline-switch input:checked+span:after{transform:translateX(34px)}"+
      ".tl-settings-state{margin:10px 4px 0;text-align:right;color:#75849d;font:700 11px Rajdhani,Saira,sans-serif}"+
      ".tl-settings-state.ok{color:#42e8a4}.tl-settings-state.err{color:#fda4af}"+
      ".tl-analysis-error{position:fixed;left:16px;right:16px;bottom:94px;z-index:100000;max-width:520px;margin:auto;padding:15px 44px 15px 16px;border-radius:16px;border:1px solid rgba(248,113,113,.55);background:linear-gradient(145deg,rgba(55,13,27,.98),rgba(12,8,22,.98));box-shadow:0 16px 50px rgba(0,0,0,.46);color:#fff;transform:translateY(24px);opacity:0;pointer-events:none;transition:.22s ease}"+
      ".tl-analysis-error.on{transform:translateY(0);opacity:1;pointer-events:auto}"+
      ".tl-analysis-error strong{display:block;margin-bottom:5px;color:#fecdd3;font:800 14px Saira,sans-serif}"+
      ".tl-analysis-error p{margin:0;color:#e2e8f0;font:600 13px/1.45 Rajdhani,Saira,sans-serif}"+
      ".tl-analysis-error small{display:block;margin-top:7px;color:#94a3b8;font:500 11px Rajdhani,Saira,sans-serif}"+
      ".tl-analysis-error button{position:absolute;right:10px;top:9px;width:30px;height:30px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:18px}"+
      "@media(max-width:390px){.tl-inline-control,.tl-inline-output{min-width:132px}.tl-inline-control input{width:91px}}";
    document.head.appendChild(s);
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function exactText(root, text) {
    var wanted = normalize(text);
    var nodes = root.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      if (normalize(nodes[i].textContent) === wanted) return nodes[i];
    }
    return null;
  }

  function findSettingsCard(page) {
    var labels = ["kontogröße", "risiko pro trade", "risiko-betrag", "lotgröße automatisch berechnen"];
    var first = exactText(page, "Kontogröße");
    if (!first) return null;
    var node = first.parentElement;
    while (node && node !== page) {
      var text = normalize(node.textContent);
      var all = true;
      for (var i = 0; i < labels.length; i++) {
        if (text.indexOf(labels[i]) < 0) { all = false; break; }
      }
      if (all) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findRow(card, labelText) {
    var labels = ["kontogröße", "risiko pro trade", "risiko-betrag", "lotgröße automatisch berechnen"];
    var label = exactText(card, labelText);
    if (!label) return null;
    var node = label.parentElement;
    var candidate = node;
    while (node && node.parentElement && node.parentElement !== card) {
      var parentText = normalize(node.parentElement.textContent);
      var containsOther = false;
      for (var i = 0; i < labels.length; i++) {
        if (labels[i] !== normalize(labelText) && parentText.indexOf(labels[i]) >= 0) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) break;
      node = node.parentElement;
      candidate = node;
    }
    return candidate;
  }

  function hideOldValue(row, kind) {
    var nodes = row.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;
      var t = normalize(el.textContent);
      var match = false;
      if (kind === "account") match = t === "nicht gesetzt" || /^[-+]?\d[\d., ]*(€|eur|\$|usd|£|gbp|chf)?$/i.test(t);
      if (kind === "risk") match = /%$/.test(t) && t.indexOf("risiko") < 0;
      if (kind === "amount") match = t === "—" || t === "-" || /^[-+]?\d[\d., ]*(€|eur|\$|usd|£|gbp|chf)$/i.test(t);
      if (match) el.style.display = "none";
    }
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

  function currencySymbol(code) {
    if (code === "USD") return "$";
    if (code === "GBP") return "£";
    if (code === "CHF") return "CHF";
    return "€";
  }

  function enhanceSettings() {
    addStyles();
    var duplicate = document.getElementById("tl-risk-settings");
    if (duplicate) duplicate.remove();

    var page = document.getElementById("page-analyse");
    if (!page) return;
    var card = findSettingsCard(page);
    if (!card || card.getAttribute("data-tl-editable") === "true") return;
    card.setAttribute("data-tl-editable", "true");

    var accountRow = findRow(card, "Kontogröße");
    var riskRow = findRow(card, "Risiko pro Trade");
    var amountRow = findRow(card, "Risiko-Betrag");
    var lotRow = findRow(card, "Lotgröße automatisch berechnen");
    if (!accountRow || !riskRow || !amountRow || !lotRow) return;

    accountRow.classList.add("tl-setting-row");
    riskRow.classList.add("tl-setting-row");
    amountRow.classList.add("tl-setting-row");
    lotRow.classList.add("tl-setting-row");
    hideOldValue(accountRow, "account");
    hideOldValue(riskRow, "risk");
    hideOldValue(amountRow, "amount");

    var accountControl = document.createElement("div");
    accountControl.className = "tl-inline-control";
    accountControl.innerHTML = '<input id="tl-account-size" type="number" min="1" step="100" inputmode="decimal" placeholder="Nicht gesetzt"><b id="tl-account-currency">€</b>';
    accountRow.appendChild(accountControl);

    var riskControl = document.createElement("div");
    riskControl.className = "tl-inline-control";
    riskControl.innerHTML = '<input id="tl-risk-percent" type="number" min="0.1" max="10" step="0.1" inputmode="decimal" value="1"><b>%</b>';
    riskRow.appendChild(riskControl);

    var amountOutput = document.createElement("div");
    amountOutput.id = "tl-risk-amount";
    amountOutput.className = "tl-inline-output";
    amountOutput.textContent = "—";
    amountRow.appendChild(amountOutput);

    var oldSwitches = lotRow.querySelectorAll('input[type="checkbox"],[role="switch"],[class*="toggle"],[class*="switch"]');
    for (var k = 0; k < oldSwitches.length; k++) oldSwitches[k].style.display = "none";
    var lotSwitch = document.createElement("label");
    lotSwitch.className = "tl-inline-switch";
    lotSwitch.innerHTML = '<input id="tl-auto-lot" type="checkbox" checked><span></span>';
    lotRow.appendChild(lotSwitch);

    var state = document.createElement("div");
    state.id = "tl-settings-state";
    state.className = "tl-settings-state";
    state.textContent = "Einstellungen werden geladen …";
    card.appendChild(state);

    var account = document.getElementById("tl-account-size");
    var risk = document.getElementById("tl-risk-percent");
    var amount = document.getElementById("tl-risk-amount");
    var autoLot = document.getElementById("tl-auto-lot");
    var symbol = document.getElementById("tl-account-currency");
    var uid = null;
    var currency = "EUR";
    var saveTimer = null;

    function setState(text, type) {
      state.textContent = text;
      state.className = "tl-settings-state" + (type ? " " + type : "");
    }

    function updateAmount() {
      var a = Number(account.value);
      var r = Number(risk.value);
      amount.textContent = a > 0 && r > 0 ? money(a * r / 100, currency) : "—";
    }

    function saveNow() {
      if (!uid || !window.TLData) return;
      var a = Number(account.value);
      var r = Number(risk.value);
      if (!isFinite(a) || a <= 0) {
        setState("Kontogröße eingeben", "err");
        return;
      }
      if (!isFinite(r) || r < 0.1 || r > 10) {
        setState("Risiko muss zwischen 0,1 und 10 % liegen", "err");
        return;
      }
      setState("Wird gespeichert …", "");
      window.TLData.saveSettings(uid, {
        account_size: a,
        risk_percent: r,
        auto_lot_calculation: !!autoLot.checked
      }).then(function (res) {
        if (res && res.ok) setState("Automatisch gespeichert ✓", "ok");
        else setState("Speichern fehlgeschlagen", "err");
      }).catch(function () { setState("Speichern fehlgeschlagen", "err"); });
    }

    function scheduleSave() {
      updateAmount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 550);
    }

    account.addEventListener("input", scheduleSave);
    risk.addEventListener("input", scheduleSave);
    autoLot.addEventListener("change", scheduleSave);

    if (!window.TLData) {
      setState("Einstellungen nicht verfügbar", "err");
      return;
    }

    window.TLData.currentUser().then(function (user) {
      if (!user) {
        setState("Bitte neu anmelden", "err");
        return null;
      }
      uid = user.id;
      return window.TLData.loadSettings(uid);
    }).then(function (res) {
      if (!res) return;
      if (res.ok && res.data) {
        currency = res.data.account_currency || "EUR";
        symbol.textContent = currencySymbol(currency);
        account.value = res.data.account_size || "";
        risk.value = res.data.risk_percent != null ? Number(res.data.risk_percent) : 1;
        autoLot.checked = res.data.auto_lot_calculation !== false;
        updateAmount();
        setState(account.value ? "Gespeichert ✓" : "Kontogröße eingeben", account.value ? "ok" : "");
      } else {
        updateAmount();
        setState("Kontogröße eingeben", "");
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
      var noConfig = { ok: false, error_code: "model_not_configured", http_status: 0 };
      showError(noConfig.error_code, "");
      return Promise.resolve(noConfig);
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
        headers: {
          Authorization: "Bearer " + token,
          apikey: CFG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (payload) {
          if (resp.ok && payload && payload.ok) {
            return {
              ok: true,
              status: payload.status,
              result: payload.result || null,
              analysis_id: payload.analysis_id || null,
              cached: !!payload.cached,
              http_status: resp.status
            };
          }
          return {
            ok: false,
            error_code: inferCode(resp.status, payload),
            analysis_id: payload && payload.analysis_id || null,
            http_status: resp.status
          };
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
