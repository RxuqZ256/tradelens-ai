(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var DEFAULTS = {
    account_currency: "EUR",
    account_size: null,
    risk_percent: 1.00,
    auto_lot_calculation: true,
    signal_type: "day",
    rr_target: 2,
    notify_signal_alerts: true,
    notify_price_alerts: true,
    notify_market_news: false,
    notify_weekly_report: true,
    appearance: "dark"
  };

  function isConfigured() {
    var u = CFG.SUPABASE_URL;
    var k = CFG.SUPABASE_ANON_KEY;
    return !!(u && k && /^https:\/\/.+/.test(u));
  }

  var _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient || !isConfigured()) return null;
    try {
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "tradelens_auth"
        }
      });
    } catch (error) {
      console.error("[TLData] Client konnte nicht initialisiert werden:", error);
      _client = null;
    }
    return _client;
  }

  function currentUser() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (result) {
      var session = result && result.data && result.data.session;
      if (!session || !session.user) return null;
      return { id: session.user.id, email: session.user.email || null };
    }).catch(function () { return null; });
  }

  function loadProfileMeta(uid) {
    var c = client();
    if (!c || !uid) return Promise.resolve(null);
    return c.from("profiles")
      .select("display_name,email,created_at")
      .eq("id", uid)
      .maybeSingle()
      .then(function (result) {
        if (result.error) return null;
        return result.data || null;
      })
      .catch(function () { return null; });
  }

  function loadSettings(uid) {
    var c = client();
    if (!c || !uid) return Promise.resolve({ ok: false, data: null, offline: true });
    return c.from("user_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
      .then(function (result) {
        if (result.error) return { ok: false, data: null, error: result.error, offline: true };
        if (result.data) return { ok: true, data: result.data, created: false };
        var row = Object.assign({ user_id: uid }, DEFAULTS);
        return c.from("user_settings").insert(row).select("*").single()
          .then(function (inserted) {
            if (inserted.error) return { ok: false, data: null, error: inserted.error, offline: true };
            return { ok: true, data: inserted.data, created: true };
          });
      })
      .catch(function (error) {
        return { ok: false, data: null, error: error, offline: true };
      });
  }

  function saveSettings(uid, partial) {
    var c = client();
    if (!c || !uid) return Promise.resolve({ ok: false, error: new Error("not_ready") });
    if (!partial || typeof partial !== "object") {
      return Promise.resolve({ ok: false, error: new Error("invalid_payload") });
    }
    var row = Object.assign({ user_id: uid }, partial);
    return c.from("user_settings")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single()
      .then(function (result) {
        if (result.error) return { ok: false, error: result.error };
        return { ok: true, data: result.data };
      })
      .catch(function (error) {
        return { ok: false, error: error };
      });
  }

  window.TLData = {
    isConfigured: isConfigured,
    currentUser: currentUser,
    loadProfileMeta: loadProfileMeta,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    DEFAULTS: DEFAULTS
  };
})();
