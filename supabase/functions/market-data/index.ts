// =====================================================================
// Edge Function: market-data
// ---------------------------------------------------------------------
// Liefert echte XAU/USD-Marktdaten fuer die TradeLens-Startseite.
// Der Twelve-Data-Key bleibt ausschliesslich serverseitig im Secret
// TWELVE_DATA_API_KEY. Der Browser erhaelt nur Kurs, Pivot-Zonen und Zeit.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TWELVE_DATA_API_KEY = Deno.env.get("TWELVE_DATA_API_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type CacheEntry = { expiresAt: number; payload: Record<string, unknown> };
let cache: CacheEntry | null = null;

async function verifyUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader || !SUPABASE_URL || !ANON_KEY) return false;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  return !error && !!data?.user;
}

async function loadGoldMarketData(): Promise<Record<string, unknown>> {
  if (cache && cache.expiresAt > Date.now()) return cache.payload;
  if (!TWELVE_DATA_API_KEY) throw new Error("market_api_not_configured");

  const params = new URLSearchParams({
    symbol: "XAU/USD",
    interval: "1day",
    outputsize: "5",
    timezone: "UTC",
    format: "JSON",
    dp: "4",
    apikey: TWELVE_DATA_API_KEY,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }

  let data: any = null;
  try { data = await response.json(); } catch (_e) { data = null; }

  if (!response.ok || !data || data.status === "error" || !Array.isArray(data.values)) {
    throw new Error("market_provider_error");
  }

  const values = data.values as Array<Record<string, unknown>>;
  if (values.length < 2) throw new Error("market_data_incomplete");

  const latest = values[0];
  const latestClose = finiteNumber(latest.close);
  if (latestClose == null) throw new Error("market_data_incomplete");

  const today = utcDate();
  const basis = values.find((row) => {
    const dt = typeof row.datetime === "string" ? row.datetime.slice(0, 10) : "";
    return dt && dt < today;
  }) ?? values[1];

  const high = finiteNumber(basis.high);
  const low = finiteNumber(basis.low);
  const close = finiteNumber(basis.close);
  if (high == null || low == null || close == null || high <= low) {
    throw new Error("market_data_incomplete");
  }

  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  const payload: Record<string, unknown> = {
    ok: true,
    symbol: "XAU/USD",
    display_symbol: "XAUUSD",
    price: round2(latestClose),
    zones: {
      resistance_2: round2(r2),
      resistance_1: round2(r1),
      pivot: round2(pivot),
      support_1: round2(s1),
      support_2: round2(s2),
    },
    basis_date: typeof basis.datetime === "string" ? basis.datetime : null,
    quote_datetime: typeof latest.datetime === "string" ? latest.datetime : null,
    updated_at: new Date().toISOString(),
    source: "Twelve Data",
    method: "classic_daily_pivots",
  };

  cache = { expiresAt: Date.now() + 45_000, payload };
  return payload;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error_code: "method_not_allowed" }, 405);

  try {
    const authorized = await verifyUser(req);
    if (!authorized) return json({ ok: false, error_code: "unauthorized" }, 401);

    const payload = await loadGoldMarketData();
    return json(payload, 200, { "Cache-Control": "private, max-age=30" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "market_internal_error";
    const status = code === "market_api_not_configured" ? 503
      : code === "market_provider_error" ? 502
      : code === "market_data_incomplete" ? 502
      : 500;

    console.error(JSON.stringify({ evt: "market-data", error_code: code }));
    return json({ ok: false, error_code: code }, status);
  }
});
