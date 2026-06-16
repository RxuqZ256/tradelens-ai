// =====================================================================
// Edge Function: analyze-chart
// ---------------------------------------------------------------------
// Single-Chart ICT-KI-Analyse. Der Browser ruft NIE den Modellanbieter.
// Zwei getrennte Clients:
//   - userClient  (Anon-Key + Authorization-Header des Nutzers, RLS)
//   - adminClient (Service-Role, NUR serverseitig, schreibt ai_analyses,
//                  laedt privaten Storage NACH Ownership-Pruefung)
// Secrets bleiben ausschliesslich in der Function-Umgebung.
// Signed URL (120 s) ist nur Transport ans Modell – nie speichern/loggen/zurueckgeben.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "./cors.ts";
import { RESULT_SCHEMA, SCHEMA_VERSION } from "./schema.ts";
import { ALLOWED_TIMEFRAMES, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from "./prompt.ts";
import { validateModelResult } from "./validation.ts";
import { buildRisk, effectiveMinRR, MAX_TARGET_RR } from "./risk.ts";
import { openAIProvider } from "./provider_openai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.4-mini";
const AI_DAILY_LIMIT = parseInt(Deno.env.get("AI_DAILY_LIMIT") ?? "10", 10) || 10;

const BUCKET = "chart-uploads";
const SIGNED_TTL = 120;            // Sekunden – nur Transport ans Modell
const PROVIDER_TIMEOUT_MS = 55000; // ~55 s
const CONF_MIN = 50;               // Mindestkonfidenz fuer Instrument/Timeframe
const SCHEMA_NAME = "tradelens_ict_single_chart";

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
}
function sanitizeInstrument(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase().replace(/[^A-Z0-9.\-/]/g, "").slice(0, 12);
  return s.length ? s : null;
}
function sanitizeTimeframe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return (ALLOWED_TIMEFRAMES as readonly string[]).includes(s) ? s : null;
}
function startOfDayUTC(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
}
function safeLog(obj: Record<string, unknown>) {
  try { console.log(JSON.stringify(obj)); } catch (_e) { /* ignore */ }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const t0 = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error_code: "method_not_allowed" }, 405);

  let runId: string | null = null;
  let admin: any = null;

  try {
    // ---- Body ----
    let body: any = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const upload_id = body?.upload_id;
    const force_reanalysis = body?.force_reanalysis === true;
    const confInstrument = sanitizeInstrument(body?.confirmed_instrument);
    const confTimeframe = sanitizeTimeframe(body?.confirmed_timeframe);

    if (!isUuid(upload_id)) {
      return jsonResponse({ ok: false, error_code: "invalid_request" }, 400);
    }

    // ---- User-Client (RLS) ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResponse({ ok: false, error_code: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    const user = ures?.user;
    if (uerr || !user) return jsonResponse({ ok: false, error_code: "unauthorized" }, 401);

    // ---- Admin-Client (Service-Role) ----
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    if (!OPENAI_API_KEY) {
      safeLog({ evt: "analyze", uid: user.id, error_code: "model_not_configured" });
      return jsonResponse({ ok: false, error_code: "model_not_configured" }, 500);
    }

    // ---- Ownership-Pruefung (RLS + expliziter Abgleich) ----
    const { data: upload, error: upErr } = await userClient
      .from("analysis_uploads")
      .select("id,user_id,storage_path,mime_type")
      .eq("id", upload_id)
      .maybeSingle();
    if (upErr || !upload || upload.user_id !== user.id) {
      return jsonResponse({ ok: false, error_code: "upload_not_found" }, 404);
    }

    // ---- Nutzereinstellungen (RLS, eigene Zeile) ----
    const { data: settingsRow } = await userClient
      .from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
    const settings = {
      account_size: settingsRow?.account_size ?? null,
      risk_percent: settingsRow?.risk_percent ?? null,
      rr_target: settingsRow?.rr_target ?? 2,
      auto_lot_calculation: settingsRow?.auto_lot_calculation !== false,
      signal_type: settingsRow?.signal_type ?? "day",
    };
    const minRR = effectiveMinRR(settings.rr_target);
    const maxRR = MAX_TARGET_RR;

    // ---- Idempotenz / Cache ----
    const { data: existingRows } = await admin
      .from("ai_analyses").select("*")
      .eq("user_id", user.id).eq("upload_id", upload_id).eq("prompt_version", PROMPT_VERSION)
      .order("created_at", { ascending: false });
    const rows = existingRows ?? [];
    const active = rows.find((r: any) => r.status === "queued" || r.status === "processing");
    if (active) {
      // Doppelklick / laufender Lauf -> vorhandenen zurueckgeben, KEIN Modellaufruf
      return jsonResponse({ ok: true, status: active.status, analysis_id: active.id, result: active.result ?? null });
    }
    if (!force_reanalysis) {
      const cached = rows.find((r: any) => ["completed", "no_trade", "needs_confirmation"].includes(r.status));
      if (cached) {
        return jsonResponse({ ok: true, status: cached.status, analysis_id: cached.id, result: cached.result ?? null, cached: true });
      }
    }

    // ---- Neuen Lauf anlegen (queued). Partieller Unique-Index verhindert
    //      zwei gleichzeitige aktive Laeufe (Doppelklick-Schutz). ----
    const ins = await admin.from("ai_analyses").insert({
      user_id: user.id, upload_id, status: "queued",
      provider: "openai", prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION,
    }).select("id").single();
    if (ins.error) {
      // Wahrscheinlich Unique-Verletzung durch parallelen Lauf -> diesen zurueckgeben
      const { data: again } = await admin.from("ai_analyses").select("*")
        .eq("user_id", user.id).eq("upload_id", upload_id).eq("prompt_version", PROMPT_VERSION)
        .in("status", ["queued", "processing"]).order("created_at", { ascending: false }).maybeSingle();
      if (again) return jsonResponse({ ok: true, status: again.status, analysis_id: again.id, result: again.result ?? null });
      throw new Error("insert_failed");
    }
    runId = ins.data.id;

    // ---- Tageslimit (zaehlt nur Laeufe mit gestartetem Provider-Call: model not null) ----
    const { count } = await admin.from("ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", startOfDayUTC()).not("model", "is", null);
    if ((count ?? 0) >= AI_DAILY_LIMIT) {
      await admin.from("ai_analyses").update({ status: "failed", error_code: "rate_limited" }).eq("id", runId);
      safeLog({ evt: "analyze", uid: user.id, upload_id, status: "failed", error_code: "rate_limited" });
      return jsonResponse({ ok: false, error_code: "rate_limited", analysis_id: runId }, 429);
    }

    // ---- processing setzen (Model erst nach erfolgreicher Signed-URL,
    //      damit ein reiner storage_error nicht aufs Tageslimit zaehlt) ----
    await admin.from("ai_analyses").update({ status: "processing" }).eq("id", runId);

    // ---- Signed URL (nur Transport ans Modell) ----
    const signed = await admin.storage.from(BUCKET).createSignedUrl(upload.storage_path, SIGNED_TTL);
    if (signed.error || !signed.data?.signedUrl) {
      await admin.from("ai_analyses").update({ status: "failed", error_code: "storage_error" }).eq("id", runId);
      return jsonResponse({ ok: false, error_code: "storage_error", analysis_id: runId }, 500);
    }
    const imageUrl = signed.data.signedUrl;

    // ---- Ab hier startet der Provider-Aufruf -> Lauf zaehlt zum Tageslimit ----
    await admin.from("ai_analyses").update({ model: OPENAI_MODEL }).eq("id", runId);

    // ---- Modellaufruf (max. 2: erster Versuch + ein Reparaturversuch) ----
    const sysPrompt = buildSystemPrompt();
    const pset = { signal_type: settings.signal_type, rr_target: settings.rr_target, min_rr: minRR, max_rr: maxRR };
    let validation: any = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const repair = attempt === 2 && validation ? validation.errors : undefined;
      const userPrompt = buildUserPrompt(pset, { instrument: confInstrument, timeframe: confTimeframe }, repair);
      let modelJson: any;
      try {
        const r = await openAIProvider.analyze({
          imageUrl, systemPrompt: sysPrompt, userPrompt,
          schema: RESULT_SCHEMA, schemaName: SCHEMA_NAME,
          model: OPENAI_MODEL, apiKey: OPENAI_API_KEY, timeoutMs: PROVIDER_TIMEOUT_MS,
        });
        modelJson = r.json;
      } catch (e) {
        // Provider-Fehler/Timeout/Refusal -> kein weiterer (teurer) Versuch
        lastErr = (e instanceof Error ? e.message : "provider_error");
        const code = lastErr.startsWith("provider_http_") ? "provider_error"
          : (lastErr === "model_refusal" ? "model_refusal"
          : (lastErr.includes("aborted") || lastErr.includes("Timeout") ? "provider_timeout" : "provider_error"));
        await admin.from("ai_analyses").update({ status: "failed", error_code: code }).eq("id", runId);
        safeLog({ evt: "analyze", uid: user.id, upload_id, status: "failed", error_code: code, ms: Date.now() - t0 });
        return jsonResponse({ ok: false, error_code: code, analysis_id: runId }, 502);
      }
      validation = validateModelResult(modelJson, minRR, maxRR);
      if (validation.outcome !== "invalid") break; // gueltig / no_trade / insufficient_data -> fertig
      if (attempt === 2) {
        await admin.from("ai_analyses").update({ status: "failed", error_code: "validation_failed" }).eq("id", runId);
        safeLog({ evt: "analyze", uid: user.id, upload_id, status: "failed", error_code: "validation_failed", ms: Date.now() - t0 });
        return jsonResponse({ ok: false, error_code: "validation_failed", analysis_id: runId }, 422);
      }
    }

    const result: any = validation.patched;
    // Schema-Metadaten serverseitig sicherstellen
    result.schema_version = SCHEMA_VERSION;
    result.prompt_version = PROMPT_VERSION;

    // Bestaetigte Werte hart uebernehmen
    if (confInstrument) { result.chart.instrument = confInstrument; }
    if (confTimeframe) { result.chart.timeframe = confTimeframe; }

    // ---- needs_confirmation-Gating (nur wenn nicht bereits bestaetigt) ----
    const instrUnsure = !confInstrument && (result.chart.instrument == null || (result.chart.instrument_confidence ?? 0) < CONF_MIN);
    const tfUnsure = !confTimeframe && (result.chart.timeframe == null || (result.chart.timeframe_confidence ?? 0) < CONF_MIN);

    let finalStatus: string;
    if (validation.outcome === "insufficient_data" || instrUnsure || tfUnsure) {
      finalStatus = "needs_confirmation";
      // keine ausfuehrbaren Level
      result.setup.direction = "none";
      result.setup.entry_type = "none";
      result.setup.entry = null; result.setup.entry_zone_low = null; result.setup.entry_zone_high = null;
      result.setup.stop_loss = null; result.setup.take_profit_1 = null; result.setup.take_profit_2 = null;
      result.chart.needs_user_confirmation = true;
    } else if (validation.outcome === "no_trade") {
      finalStatus = "no_trade";
    } else {
      finalStatus = "completed";
    }

    // ---- Deterministische Risiko-/RR-Werte ----
    const rrForRisk = finalStatus === "completed" ? validation.rr : null;
    result.risk = buildRisk(
      { account_size: settings.account_size, risk_percent: settings.risk_percent, rr_target: settings.rr_target, auto_lot_calculation: settings.auto_lot_calculation },
      rrForRisk,
    );
    result.meta = { provider: "openai", model: OPENAI_MODEL, prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION };

    // ---- Speichern (validiertes Ergebnis + denormalisierte Felder) ----
    const denorm = {
      status: finalStatus,
      instrument: result.chart?.instrument ?? null,
      timeframe: result.chart?.timeframe ?? null,
      setup_status: result.setup?.status ?? null,
      direction: result.setup?.direction ?? null,
      confidence: Number.isFinite(result.setup?.setup_confidence) ? result.setup.setup_confidence : null,
      result, error_code: null,
    };
    await admin.from("ai_analyses").update(denorm).eq("id", runId);

    safeLog({ evt: "analyze", uid: user.id, upload_id, status: finalStatus, ms: Date.now() - t0 });
    return jsonResponse({ ok: true, status: finalStatus, analysis_id: runId, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    safeLog({ evt: "analyze", status: "failed", error_code: "internal_error", detail: msg.slice(0, 120) });
    try {
      if (runId && admin) await admin.from("ai_analyses").update({ status: "failed", error_code: "internal_error" }).eq("id", runId);
    } catch (_e) { /* ignore */ }
    return jsonResponse({ ok: false, error_code: "internal_error" }, 500);
  }
});
