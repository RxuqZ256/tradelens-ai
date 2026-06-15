/* =====================================================================
   TradeLens AI – Upload-Datenschicht (Phase 3)
   ---------------------------------------------------------------------
   Privater Storage-Bucket "chart-uploads" + Tabelle public.analysis_uploads.
   - Datei-Validierung (MIME exakt, <= 20 MB, > 0 Byte, HEIC/HEIF ablehnen)
   - Echter resumabler Upload via tus-js-client (window.tus) mit echten
     Byte-Progress-Events (kein simulierter Verlauf)
   - Metadaten erst NACH erfolgreichem Storage-Upload speichern
   - Signed URLs (300 s), niemals oeffentliche URLs, nie in localStorage
   - Ersetzen / Entfernen mit kontrolliertem Rollback

   Abhaengigkeiten (in dieser Reihenfolge VOR dieser Datei laden):
     1) tradelens-config.js  -> window.TRADELENS_CONFIG
     2) supabase-js (UMD)     -> window.supabase
     3) tradelens-auth.js     -> window.TLAuth
     4) tradelens-data.js     -> window.TLData
     5) tus-js-client (UMD)   -> window.tus
   Diese Datei nutzt KEINEN Service-Role-Key. Die Session wird ueber den
   gemeinsamen storageKey "tradelens_auth" geteilt; jede Anfrage traegt das
   JWT des angemeldeten Nutzers (RLS greift).
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.TRADELENS_CONFIG || {};
  var BUCKET = "chart-uploads";
  var MAX_BYTES = 20971520;          // 20 MB
  var SIGNED_TTL = 300;              // Sekunden
  var EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

  /* ---------- Konfiguration / Verfuegbarkeit -------------------------- */
  function isConfigured() {
    var u = CFG.SUPABASE_URL, k = CFG.SUPABASE_ANON_KEY;
    return !!(u && k && /^https:\/\/.+/.test(u));
  }
  function tusReady() { return !!(window.tus && window.tus.Upload); }

  /* ---------- Supabase-Client (geteilte Session) --------------------- */
  var _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient || !isConfigured()) return null;
    try {
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "tradelens_auth" }
      });
    } catch (e) { console.error("[TLUpload] init:", e); _client = null; }
    return _client;
  }

  function session() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession()
      .then(function (r) { return (r && r.data && r.data.session) || null; })
      .catch(function () { return null; });
  }

  /* ---------- Datei-Validierung -------------------------------------- */
  function validate(file) {
    if (!file) return { ok: false, error: "Keine Datei ausgewaehlt." };
    var type = (file.type || "").toLowerCase();
    var name = (file.name || "").toLowerCase();
    // HEIC/HEIF ausdruecklich, verstaendlich ablehnen
    if (type === "image/heic" || type === "image/heif" || /\.(heic|heif)$/.test(name)) {
      return { ok: false, error: "Dieses Dateiformat wird noch nicht unterstuetzt." };
    }
    // MIME exakt pruefen (nicht nur die Endung)
    if (!EXT_BY_MIME[type]) {
      return { ok: false, error: "Dieses Dateiformat wird noch nicht unterstuetzt." };
    }
    if (!(file.size > 0)) {
      return { ok: false, error: "Die Datei ist leer." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: "Die Datei darf maximal 20 MB gross sein." };
    }
    return { ok: true, ext: EXT_BY_MIME[type] };
  }

  /* ---------- UUID clientseitig -------------------------------------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback (RFC4122 v4)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /* ---------- Resumabler Upload (TUS) -------------------------------- */
  function tusUpload(file, path, accessToken, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!tusReady()) { reject(new Error("tus_unavailable")); return; }
      var endpoint = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/storage/v1/upload/resumable";
      var upload = new window.tus.Upload(file, {
        endpoint: endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000], // Retry bei kurzen Netzunterbrechungen
        headers: {
          authorization: "Bearer " + accessToken,
          "x-upsert": "false"                       // niemals ueberschreiben
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,                 // Supabase erwartet 6-MB-Chunks
        metadata: {
          bucketName: BUCKET,
          objectName: path,                         // <user_id>/<upload_id>.<ext>
          contentType: file.type,
          cacheControl: "3600"
        },
        onError: function (err) { reject(err); },
        onProgress: function (sent, total) {
          if (typeof onProgress === "function" && total > 0) {
            onProgress(Math.max(0, Math.min(100, Math.round((sent / total) * 100))), sent, total);
          }
        },
        onSuccess: function () { resolve(true); }
      });
      // Falls ein abgebrochener Upload existiert: fortsetzen, sonst neu starten
      upload.findPreviousUploads().then(function (prev) {
        if (prev && prev.length) { try { upload.resumeFromPreviousUpload(prev[0]); } catch (e) {} }
        upload.start();
      }).catch(function () { upload.start(); });
    });
  }

  /* ---------- DB-Operationen ----------------------------------------- */
  function insertMeta(row) {
    var c = client();
    return c.from("analysis_uploads").insert(row).select("*").single();
  }
  function deleteMeta(id) {
    var c = client();
    return c.from("analysis_uploads").delete().eq("id", id);
  }
  function latestOpen(uid) {
    var c = client();
    return c.from("analysis_uploads").select("*")
      .eq("user_id", uid).eq("status", "uploaded")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
  }

  /* ---------- Storage-Operationen ------------------------------------ */
  function removeStorage(path) {
    var c = client();
    return c.storage.from(BUCKET).remove([path]); // Loeschen IMMER ueber die API, nie per SQL
  }
  function signedUrl(path) {
    var c = client();
    return c.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
      .then(function (r) {
        if (r.error || !r.data || !r.data.signedUrl) { return null; }
        return r.data.signedUrl;
      })
      .catch(function () { return null; });
  }

  /* ---------- Hauptablauf: neuer Upload ------------------------------
     hooks: { onState(state), onProgress(pct,sent,total) }
     Rueckgabe: { ok, row, error }
  -------------------------------------------------------------------- */
  function createUpload(file, hooks) {
    hooks = hooks || {};
    var setState = function (s) { if (hooks.onState) hooks.onState(s); };

    return session().then(function (sess) {
      if (!sess || !sess.user || !sess.access_token) {
        return { ok: false, error: "Keine aktive Anmeldung gefunden." };
      }
      if (!tusReady()) {
        return { ok: false, error: "Upload-Komponente konnte nicht geladen werden. Bitte Seite neu laden." };
      }
      setState("validating");
      var v = validate(file);
      if (!v.ok) return { ok: false, error: v.error };

      var uid = sess.user.id;
      var id = uuid();
      var path = uid + "/" + id + "." + v.ext; // Endung nur aus MIME-Type

      setState("uploading");
      return tusUpload(file, path, sess.access_token, hooks.onProgress)
        .then(function () {
          // Storage erfolgreich -> jetzt Metadaten schreiben
          setState("saving");
          var row = {
            id: id, user_id: uid, storage_path: path,
            original_name: file.name || null, mime_type: file.type,
            size_bytes: file.size, status: "uploaded"
          };
          return insertMeta(row).then(function (res) {
            if (res.error) {
              // Rollback: hochgeladene Datei wieder entfernen
              console.error("[TLUpload] insert:", res.error.message);
              return removeStorage(path).catch(function () {}).then(function () {
                return { ok: false, error: "Die Datei konnte nicht hochgeladen werden." };
              });
            }
            setState("success");
            return { ok: true, row: res.data };
          });
        })
        .catch(function (err) {
          console.error("[TLUpload] tus:", err);
          return { ok: false, error: "Die Datei konnte nicht hochgeladen werden." };
        });
    });
  }

  /* ---------- Ersetzen ----------------------------------------------
     Erst neuen Upload vollstaendig abschliessen, dann alten entfernen.
     Schlaegt der neue Upload fehl, bleibt der alte unveraendert.
  -------------------------------------------------------------------- */
  function replaceUpload(file, oldRow, hooks) {
    return createUpload(file, hooks).then(function (res) {
      if (!res.ok) return res; // alter Upload bleibt erhalten
      if (oldRow && oldRow.storage_path && oldRow.id) {
        return removeStorage(oldRow.storage_path).catch(function () {})
          .then(function () { return deleteMeta(oldRow.id).catch(function () {}); })
          .then(function () { return res; });
      }
      return res;
    });
  }

  /* ---------- Entfernen ----------------------------------------------
     Storage zuerst, dann DB. Schlaegt der DB-Delete nach erfolgreichem
     Storage-Delete fehl: einmal erneut versuchen; sonst ehrlich als
     "nicht vollstaendig bereinigt" zurueckmelden.
     Rueckgabe: { ok, partial, error }
  -------------------------------------------------------------------- */
  function removeUpload(row) {
    if (!row || !row.storage_path || !row.id) {
      return Promise.resolve({ ok: false, error: "Kein Upload zum Entfernen vorhanden." });
    }
    return removeStorage(row.storage_path).then(function (r) {
      if (r && r.error) {
        console.error("[TLUpload] storage remove:", r.error.message);
        return { ok: false, error: "Die Datei konnte nicht entfernt werden." };
      }
      return deleteMeta(row.id).then(function (d) {
        if (d.error) {
          // einmal erneut versuchen
          return deleteMeta(row.id).then(function (d2) {
            if (d2.error) {
              console.error("[TLUpload] meta delete:", d2.error.message);
              return { ok: false, partial: true, error: "Die Datei wurde entfernt, der Datensatz konnte nicht vollstaendig bereinigt werden." };
            }
            return { ok: true };
          });
        }
        return { ok: true };
      });
    }).catch(function (e) {
      console.error("[TLUpload] remove:", e);
      return { ok: false, error: "Die Datei konnte nicht entfernt werden." };
    });
  }

  /* ---------- Letzten offenen Upload laden + Signed URL -------------- */
  function loadLatestOpen() {
    return session().then(function (sess) {
      if (!sess || !sess.user) return { ok: false, error: "Keine aktive Anmeldung gefunden." };
      return latestOpen(sess.user.id).then(function (r) {
        if (r.error) { console.warn("[TLUpload] latest:", r.error.message); return { ok: false, error: "Laden fehlgeschlagen." }; }
        if (!r.data) return { ok: true, row: null };
        return { ok: true, row: r.data };
      });
    });
  }

  /* ---------- Oeffentliche API --------------------------------------- */
  window.TLUpload = {
    isConfigured: isConfigured,
    tusReady: tusReady,
    validate: validate,
    createUpload: createUpload,
    replaceUpload: replaceUpload,
    removeUpload: removeUpload,
    loadLatestOpen: loadLatestOpen,
    signedUrl: signedUrl,
    BUCKET: BUCKET,
    MAX_BYTES: MAX_BYTES,
    SIGNED_TTL: SIGNED_TTL
  };
})();
