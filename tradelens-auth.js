/* =====================================================================
   TradeLens AI – Auth-Schicht (gemeinsam für Login & App)
   ---------------------------------------------------------------------
   Abhängigkeiten (in dieser Reihenfolge VOR dieser Datei laden):
     1) tradelens-config.js   -> window.TRADELENS_CONFIG
     2) supabase-js (UMD)      -> window.supabase
   Diese Datei legt KEINE Passwörter ab und nutzt KEINEN Service-Role-Key.
   Sessions verwaltet ausschließlich supabase-js (localStorage-Token).
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var MODE = (CFG.APP_MODE === "production") ? "production" : "preview";
  var PLACEHOLDERS = ["DEINE_SUPABASE_URL_HIER", "DEIN_SUPABASE_ANON_KEY_HIER"];

  /* ---------- Konfigurationsprüfung ------------------------------------ */
  function isConfigured() {
    var u = CFG.SUPABASE_URL, k = CFG.SUPABASE_ANON_KEY;
    if (!u || !k) return false;
    if (PLACEHOLDERS.indexOf(u) >= 0 || PLACEHOLDERS.indexOf(k) >= 0) return false;
    return /^https:\/\/.+/.test(u);
  }

  /* ---------- Supabase-Client (lazy) ----------------------------------- */
  var _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!isConfigured()) return null;
    try {
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "tradelens_auth"
        }
      });
    } catch (e) {
      console.error("[TLAuth] Supabase-Client konnte nicht initialisiert werden:", e);
      _client = null;
    }
    return _client;
  }

  /* ---------- Fehler-Mapping (DE, keine Tokens/Internas zeigen) --------- */
  function mapAuthError(err) {
    if (!err) return "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.";
    // Vollständigen Fehler nur in die Konsole, nie in die UI:
    console.warn("[TLAuth] Auth-Fehler:", err);
    var msg = (err.message || "").toLowerCase();
    var status = err.status || err.code;

    if (msg.indexOf("invalid login credentials") >= 0)
      return "E-Mail oder Passwort ist falsch.";
    if (msg.indexOf("email not confirmed") >= 0)
      return "Bitte bestätige zuerst deine E-Mail-Adresse. Prüfe dein Postfach.";
    if (msg.indexOf("user already registered") >= 0 || msg.indexOf("already registered") >= 0)
      return "Für diese E-Mail existiert bereits ein Konto. Bitte melde dich an.";
    if (msg.indexOf("password should be at least") >= 0 || msg.indexOf("weak password") >= 0)
      return "Das Passwort ist zu schwach. Bitte wähle ein stärkeres Passwort.";
    if (msg.indexOf("unable to validate email address") >= 0 || msg.indexOf("invalid email") >= 0)
      return "Die E-Mail-Adresse ist ungültig.";
    if (msg.indexOf("email rate limit") >= 0 || msg.indexOf("rate limit") >= 0 || status === 429)
      return "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.";
    if (msg.indexOf("same password") >= 0 || msg.indexOf("should be different") >= 0)
      return "Das neue Passwort darf nicht mit dem alten identisch sein.";
    if (msg.indexOf("expired") >= 0 || msg.indexOf("otp") >= 0 || msg.indexOf("recovery") >= 0 ||
        (msg.indexOf("token") >= 0 && msg.indexOf("invalid") >= 0))
      return "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.";
    if (msg.indexOf("failed to fetch") >= 0 || msg.indexOf("networkerror") >= 0 || msg.indexOf("network") >= 0)
      return "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.";

    return "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.";
  }

  /* ---------- Session-Helfer ------------------------------------------- */
  function getSession() {
    var c = client();
    if (!c) return Promise.resolve({ session: null, error: new Error("not_configured") });
    return c.auth.getSession()
      .then(function (r) { return { session: (r.data && r.data.session) || null, error: r.error || null }; })
      .catch(function (e) { return { session: null, error: e }; });
  }

  /* ---------- Auth-Aktionen --------------------------------------------- */
  function signUp(email, password, displayName) {
    var c = client();
    if (!c) return Promise.resolve({ ok: false, message: "Supabase ist nicht konfiguriert." });
    return c.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: CFG.REDIRECT_URL,
        data: { display_name: (displayName || "").trim() }
      }
    }).then(function (r) {
      if (r.error) return { ok: false, message: mapAuthError(r.error) };
      var hasSession = !!(r.data && r.data.session);
      return { ok: true, session: hasSession, user: r.data && r.data.user };
    }).catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  function signIn(email, password) {
    var c = client();
    if (!c) return Promise.resolve({ ok: false, message: "Supabase ist nicht konfiguriert." });
    return c.auth.signInWithPassword({ email: email.trim(), password: password })
      .then(function (r) {
        if (r.error) return { ok: false, message: mapAuthError(r.error) };
        return { ok: true, session: r.data && r.data.session };
      }).catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  function signOut() {
    var c = client();
    if (!c) return Promise.resolve({ ok: true });
    return c.auth.signOut()
      .then(function () { return { ok: true }; })
      .catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  function sendRecoveryEmail(email) {
    var c = client();
    if (!c) return Promise.resolve({ ok: false, message: "Supabase ist nicht konfiguriert." });
    return c.auth.resetPasswordForEmail(email.trim(), { redirectTo: CFG.REDIRECT_URL })
      .then(function (r) {
        // Aus Datenschutzgründen meldet Supabase auch bei unbekannter Mail Erfolg.
        if (r.error) return { ok: false, message: mapAuthError(r.error) };
        return { ok: true };
      }).catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  function updatePassword(newPassword) {
    var c = client();
    if (!c) return Promise.resolve({ ok: false, message: "Supabase ist nicht konfiguriert." });
    return c.auth.updateUser({ password: newPassword })
      .then(function (r) {
        if (r.error) return { ok: false, message: mapAuthError(r.error) };
        return { ok: true };
      }).catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  function resendVerification(email) {
    var c = client();
    if (!c) return Promise.resolve({ ok: false, message: "Supabase ist nicht konfiguriert." });
    return c.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: CFG.REDIRECT_URL }
    }).then(function (r) {
      if (r.error) return { ok: false, message: mapAuthError(r.error) };
      return { ok: true };
    }).catch(function (e) { return { ok: false, message: mapAuthError(e) }; });
  }

  /* ---------- Recovery-Event ------------------------------------------- */
  // Liefert true, sobald Supabase einen gültigen PASSWORD_RECOVERY-Zustand
  // erkannt hat (Klick auf den Link aus der Recovery-Mail).
  var _recoveryActive = false;
  function onPasswordRecovery(cb) {
    var c = client();
    if (!c) return;
    c.auth.onAuthStateChange(function (event, session) {
      if (event === "PASSWORD_RECOVERY") {
        _recoveryActive = true;
        try { cb && cb(session); } catch (e) { console.error(e); }
      }
    });
  }
  function isRecoveryActive() { return _recoveryActive; }

  /* ---------- Navigation ----------------------------------------------- */
  function gotoApp() { window.location.replace(CFG.APP_FILE || "TradeLens_AI_App.html"); }
  function gotoLogin() { window.location.replace(CFG.LOGIN_FILE || "TradeLens_AI_Login.html"); }

  /* ---------- Guard für die Login-Seite -------------------------------- */
  // Bei gültiger Session -> weiter zur App (außer der Nutzer ist gerade
  // in einem Recovery-Flow). In Preview ohne Konfiguration: nichts tun.
  function guardLogin() {
    if (MODE !== "production" || !isConfigured()) {
      console.info("[TLAuth] Login im " + MODE + "-Modus (kein Auto-Redirect).");
      return;
    }
    // kleine Verzögerung, damit ein evtl. Recovery-Event zuerst greift
    setTimeout(function () {
      getSession().then(function (res) {
        if (_recoveryActive) return;            // Recovery hat Vorrang
        if (res.session) gotoApp();
      });
    }, 350);
  }

  /* ---------- Guard für die App-Seite ---------------------------------- */
  // Ablauf (flackerfrei): App ist via <html class="tl-gate"> verborgen.
  //  - preview / nicht konfiguriert -> App sofort anzeigen
  //  - production + Session          -> App anzeigen
  //  - production + keine Session    -> zum Login
  //  - production + Fehler/Timeout   -> kontrollierter Fehlerzustand
  function reveal() {
    document.documentElement.classList.remove("tl-gate");
    removeOverlay();
  }
  function overlay(html) {
    var ov = document.getElementById("tl-auth-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "tl-auth-overlay";
      ov.setAttribute("style",
        "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;" +
        "justify-content:center;background:#04060b;color:#94A3B8;" +
        "font-family:'Saira',-apple-system,sans-serif;text-align:center;padding:24px;");
      document.body.appendChild(ov);
    }
    ov.innerHTML = html;
  }
  function removeOverlay() {
    var ov = document.getElementById("tl-auth-overlay");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function spinnerHTML(text) {
    return '<div>' +
      '<div style="width:34px;height:34px;margin:0 auto 14px;border:2.5px solid rgba(0,229,255,0.25);' +
      'border-top-color:#00E5FF;border-radius:50%;animation:tlspin .8s linear infinite"></div>' +
      '<div style="font-size:13px;letter-spacing:.5px">' + text + '</div>' +
      '<style>@keyframes tlspin{to{transform:rotate(360deg)}}</style></div>';
  }
  function errorHTML(text) {
    return '<div style="max-width:300px">' +
      '<div style="font-family:\'Saira\';font-weight:700;color:#F8FAFC;font-size:15px;letter-spacing:1px;margin-bottom:8px">TRADELENS <span style="color:#00E5FF">AI</span></div>' +
      '<div style="font-size:13px;line-height:1.5;margin-bottom:16px">' + text + '</div>' +
      '<button onclick="TLAuth.gotoLogin()" style="cursor:pointer;border:1px solid rgba(0,229,255,0.5);' +
      'background:rgba(0,229,255,0.08);color:#00E5FF;font-family:\'Saira\';font-weight:600;font-size:13px;' +
      'letter-spacing:1px;padding:10px 20px;border-radius:12px">ZUM LOGIN</button></div>';
  }

  function guardApp() {
    // Preview oder (noch) nicht konfiguriert -> Designvorschau erlauben.
    if (MODE !== "production" || !isConfigured()) {
      console.info("[TLAuth] App im " + MODE + "-Modus" +
        (isConfigured() ? "" : " (Supabase nicht konfiguriert)") + " – kein Auth-Guard.");
      reveal();
      return;
    }
    overlay(spinnerHTML("Sitzung wird geprüft …"));

    var settled = false;
    var timeout = setTimeout(function () {
      if (settled) return;
      settled = true;
      overlay(errorHTML("Die Sitzungsprüfung hat zu lange gedauert. Bitte erneut anmelden."));
    }, 8000);

    getSession().then(function (res) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (res.error && res.error.message !== "not_configured") {
        overlay(errorHTML("Die Sitzung konnte nicht geprüft werden. Bitte melde dich erneut an."));
        return;
      }
      if (res.session) {
        reveal();
      } else {
        overlay(spinnerHTML("Weiterleitung zur Anmeldung …"));
        gotoLogin();
      }
    }).catch(function () {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      overlay(errorHTML("Die Sitzung konnte nicht geprüft werden. Bitte melde dich erneut an."));
    });
  }

  /* ---------- Logout (aus dem Profil-Tab) ------------------------------ */
  function logout() {
    if (MODE !== "production" || !isConfigured()) {
      // Im Preview gibt es keine echte Session – trotzdem zum Login führen.
      gotoLogin();
      return;
    }
    signOut().then(function () { gotoLogin(); });
  }

  /* ---------- Öffentliche API ------------------------------------------ */
  window.TLAuth = {
    mode: MODE,
    isConfigured: isConfigured,
    getSession: getSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    sendRecoveryEmail: sendRecoveryEmail,
    updatePassword: updatePassword,
    resendVerification: resendVerification,
    onPasswordRecovery: onPasswordRecovery,
    isRecoveryActive: isRecoveryActive,
    guardLogin: guardLogin,
    guardApp: guardApp,
    gotoApp: gotoApp,
    gotoLogin: gotoLogin,
    mapAuthError: mapAuthError
  };
  // bequemer globaler Logout-Handler für onclick="tlLogout()"
  window.tlLogout = logout;
})();
