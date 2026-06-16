(function () {
  "use strict";
  var CFG = window.TRADELENS_CONFIG || {};

  function addStyles() {
    if (document.getElementById("tl-analysis-ui-style")) return;
    var s = document.createElement("style");
    s.id = "tl-analysis-ui-style";
    s.textContent =
      ".tl-risk-panel{margin:14px 0 18px;padding:17px;border-radius:20px;border:1px solid rgba(0,229,255,.25);background:linear-gradient(145deg,rgba(7,17,39,.96),rgba(9,8,28,.96));box-shadow:0 14px 36px rgba(0,0,0,.24)}"+
      ".tl-risk-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.tl-risk-head h3{margin:0;color:#f8fafc;font:800 15px Saira,sans-serif}.tl-risk-head p{margin:3px 0 0;color:#71809b;font:600 11px/1.35 Rajdhani,Saira,sans-serif}.tl-risk-badge{height:max-content;padding:6px 9px;border-radius:999px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.08);color:#67e8f9;font:800 9px Saira,sans-serif}"+
      ".tl-risk-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.tl-risk-field span{display:block;margin-bottom:6px;color:#8fa1bb;font:700 11px Rajdhani,Saira,sans-serif}.tl-risk-input{display:flex;align-items:center;height:48px;padding:0 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.62)}.tl-risk-input:focus-within{border-color:rgba(0,229,255,.68);box-shadow:0 0 0 3px rgba(0,229,255,.08)}.tl-risk-input b{color:#5ee7f5;font:800 13px Rajdhani,Saira,sans-serif}.tl-risk-input input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:#fff;font:800 17px Saira,sans-serif;text-align:right}"+
      ".tl-risk-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:11px 12px;border-radius:14px;background:rgba(0,229,255,.055);border:1px solid rgba(0,229,255,.12)}.tl-risk-summary span{color:#8fa1bb;font:700 11px Rajdhani,Saira,sans-serif}.tl-risk-summary strong{color:#67e8f9;font:800 16px Saira,sans-serif}.tl-risk-actions{display:flex;align-items:center;gap:10px;margin-top:12px}.tl-risk-save{flex:1;height:44px;border:0;border-radius:14px;background:linear-gradient(100deg,#00d5e8,#4f7cff 58%,#7c3aed);color:#fff;font:800 12px Saira,sans-serif}.tl-risk-save:disabled{opacity:.55}.tl-risk-state{min-width:92px;text-align:right;color:#71809b;font:700 10px/1.3 Rajdhani,Saira,sans-serif}.tl-risk-state.ok{color:#5ee7a8}.tl-risk-state.err{color:#fda4af}"+
      ".tl-analysis-error{position:fixed;left:16px;right:16px;bottom:94px;z-index:100000;max-width:520px;margin:auto;padding:15px 44px 15px 16px;border-radius:16px;border:1px solid rgba(248,113,113,.55);background:linear-gradient(145deg,rgba(55,13,27,.98),rgba(12,8,22,.98));box-shadow:0 16px 50px rgba(0,0,0,.46);color:#fff;transform:translateY(24px);opacity:0;pointer-events:none;transition:.22s ease}.tl-analysis-error.on{transform:translateY(0);opacity:1;pointer-events:auto}.tl-analysis-error strong{display:block;margin-bottom:5px;color:#fecdd3;font:800 14px Saira,sans-serif}.tl-analysis-error p{margin:0;color:#e2e8f0;font:600 13px/1.45 Rajdhani,Saira,sans-serif}.tl-analysis-error small{display:block;margin-top:7px;color:#94a3b8;font:500 11px Rajdhani,Saira,sans-serif}.tl-analysis-error button{position:absolute;right:10px;top:9px;width:30px;height:30px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:18px}"+
      "@media(max-width:390px){.tl-risk-grid{grid-template-columns:1fr}.tl-risk-actions{flex-direction:column;align-items:stretch}.tl-risk-state{text-align:center;min-width:0}}";
    document.head.appendChild(s);
  }

  function money(value, currency) {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(Number(value) || 0); }
    catch (_e) { return (Number(value) || 0).toFixed(2) + " " + (currency || "EUR"); }
  }

  function initRiskPanel() {
    addStyles();
    var page = document.getElementById("page-analyse");
    if (!page || document.getElementById("tl-risk-settings")) return;
    var panel = document.createElement("section");
    panel.id = "tl-risk-settings";
    panel.className = "tl-risk-panel";
    panel.innerHTML =
      '<div class="tl-risk-head"><div><h3>RISIKO-EINSTELLUNGEN</h3><p>Diese Werte werden bei jeder neuen KI-Analyse verwendet.</p></div><div class="tl-risk-badge">LIVE</div></div>'+
      '<div class="tl-risk-grid">'+
        '<label class="tl-risk-field"><span>Kontogröße</span><div class="tl-risk-input"><b id="tl-currency">€</b><input id="tl-account-size" type="number" min="1" step="100" inputmode="decimal" placeholder="10000"></div></label>'+
        '<label class="tl-risk-field"><span>Risiko pro Trade</span><div class="tl-risk-input"><input id="tl-risk-percent" type="number" min="0.1" max="10" step="0.1" inputmode="decimal" placeholder="1.0"><b>%</b></div></label>'+
      '</div>'+
      '<div class="tl-risk-summary"><span>Maximales Risiko pro Trade</span><strong id="tl-risk-amount">€0,00</strong></div>'+
      '<div class="tl-risk-actions"><button type="button" class="tl-risk-save" id="tl-risk-save">EINSTELLUNGEN SPEICHERN</button><div class="tl-risk-state" id="tl-risk-state">Wird geladen …</div></div>';

    var old = page.querySelector(".settings-card");
    if (old && old.parentNode) {
      old.style.display = "none";
      old.parentNode.insertBefore(panel, old.nextSibling);
    } else {
      var anchor = page.querySelector(".upload-card,.analysis-upload,.card");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      else page.appendChild(panel);
    }

    var account = document.getElementById("tl-account-size");
    var risk = document.getElementById("tl-risk-percent");
    var amount = document.getElementById("tl-risk-amount");
    var symbol = document.getElementById("tl-currency");
    var save = document.getElementById("tl-risk-save");
    var state = document.getElementById("tl-risk-state");
    var uid = null, currency = "EUR";

    function setState(text, type) {
      state.textContent = text;
      state.className = "tl-risk-state" + (type ? " " + type : "");
    }
    function refreshAmount() {
      amount.textContent = money((Number(account.value) || 0) * (Number(risk.value) || 0) / 100, currency);
    }
    function currencySymbol(code) {
      return code === "USD" ? "$" : code === "GBP" ? "£" : code === "CHF" ? "CHF" : "€";
    }
    account.addEventListener("input", refreshAmount);
    risk.addEventListener("input", refreshAmount);

    if (!window.TLData) { setState("Nicht verfügbar", "err"); return; }
    window.TLData.currentUser().then(function (user) {
      if (!user) { setState("Bitte anmelden", "err"); return null; }
      uid = user.id;
      return window.TLData.loadSettings(uid);
    }).then(function (r) {
      if (!r) return;
      if (r.ok && r.data) {
        currency = r.data.account_currency || "EUR";
        symbol.textContent = currencySymbol(currency);
        account.value = r.data.account_size || "";
        risk.value = r.data.risk_percent != null ? Number(r.data.risk_percent) : 1;
        refreshAmount();
        setState("Gespeichert", "ok");
      } else {
        risk.value = "1";
        refreshAmount();
        setState("Noch nicht gespeichert", "");
      }
    }).catch(function () { setState("Laden fehlgeschlagen", "err"); });

    save.addEventListener("click", function () {
      var a = Number(account.value), r = Number(risk.value);
      if (!uid) { setState("Bitte neu anmelden", "err"); return; }
      if (!isFinite(a) || a <= 0) { setState("Kontogröße prüfen", "err"); account.focus(); return; }
      if (!isFinite(r) || r < 0.1 || r > 10) { setState("Risiko: 0,1–10 %", "err"); risk.focus(); return; }
      save.disabled = true;
      setState("Speichert …", "");
      window.TLData.saveSettings(uid, { account_size: a, risk_percent: r }).then(function (res) {
        save.disabled = false;
        if (res && res.ok) { refreshAmount(); setState("Gespeichert ✓", "ok"); }
        else setState("Speichern fehlgeschlagen", "err");
      }).catch(function () { save.disabled = false; setState("Speichern fehlgeschlagen", "err"); });
    });
  }

  var ERROR_TEXT = {
    unauthorized: "Keine aktive Anmeldung gefunden. Bitte melde dich erneut an.",
    invalid_request: "Die Anfrage war ungültig. Lade den Chart bitte neu hoch.",
    upload_not_found: "Der Chart wurde nicht gefunden. Lade ihn bitte erneut hoch.",
    rate_limited: "Dein tägliches Analyselimit ist erreicht.",
    model_not_configured: "Die KI ist serverseitig noch nicht vollständig eingerichtet.",
    storage_error: "Der Chart konnte nicht aus dem Speicher geladen werden.",
    provider_error: "Der KI-Dienst konnte nicht erreicht werden.",
    provider_timeout: "Die Analyse hat zu lange gedauert.",
    validation_failed: "Das Analyseergebnis war nicht schlüssig.",
    function_not_deployed: "Die Supabase-Funktion analyze-chart ist noch nicht veröffentlicht.",
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

  function diagnoseFunction(done) {
    var url = (CFG.SUPABASE_URL || "").replace(/\/+$/, "") + "/functions/v1/analyze-chart";
    if (!url || !window.fetch) { done("internal_error", ""); return; }
    fetch(url, { method: "OPTIONS" }).then(function (r) {
      if (r.status === 404) done("function_not_deployed", "HTTP 404");
      else done("internal_error", "HTTP " + r.status);
    }).catch(function () { done("internal_error", "Netzwerkfehler"); });
  }

  function wrapAnalysis() {
    if (!window.TLAnalysis || window.TLAnalysis.__uiEnhanced) return;
    var original = window.TLAnalysis.analyze;
    if (typeof original !== "function") return;
    window.TLAnalysis.analyze = function () {
      return original.apply(window.TLAnalysis, arguments).then(function (result) {
        if (!result || !result.ok) {
          var code = result && result.error_code || "internal_error";
          if (code === "internal_error") diagnoseFunction(showError);
          else showError(code, "");
        }
        return result;
      });
    };
    window.TLAnalysis.__uiEnhanced = true;
  }

  function boot() {
    initRiskPanel();
    wrapAnalysis();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();
