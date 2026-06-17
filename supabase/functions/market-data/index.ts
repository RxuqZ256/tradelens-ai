const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const allowedIntervals = new Set([
  "1min",
  "5min",
  "15min",
  "30min",
  "45min",
  "1h",
  "2h",
  "4h",
  "1day",
  "1week",
  "1month",
]);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(
      {
        ok: false,
        error: "method_not_allowed",
        message: "Only GET and POST are supported.",
      },
      405,
    );
  }

  try {
    let input: Record<string, unknown> = {};

    if (req.method === "POST") {
      try {
        input = await req.json();
      } catch {
        return jsonResponse(
          {
            ok: false,
            error: "invalid_json",
            message: "The request body must contain valid JSON.",
          },
          400,
        );
      }
    } else {
      const requestUrl = new URL(req.url);
      input = {
        symbol: requestUrl.searchParams.get("symbol"),
        interval: requestUrl.searchParams.get("interval"),
        outputsize: requestUrl.searchParams.get("outputsize"),
      };
    }

    const symbol = String(input.symbol ?? "XAU/USD")
      .trim()
      .toUpperCase();
    const interval = String(input.interval ?? "15min").trim();
    const requestedOutputsize = Number(input.outputsize ?? 20);
    const outputsize = Number.isFinite(requestedOutputsize)
      ? Math.min(100, Math.max(1, Math.trunc(requestedOutputsize)))
      : 20;

    if (!/^[A-Z0-9._:/-]{1,30}$/.test(symbol)) {
      return jsonResponse(
        {
          ok: false,
          error: "invalid_symbol",
          message: "The supplied market symbol is invalid.",
        },
        400,
      );
    }

    if (!allowedIntervals.has(interval)) {
      return jsonResponse(
        {
          ok: false,
          error: "invalid_interval",
          message: "The supplied interval is not supported.",
        },
        400,
      );
    }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          error: "secret_missing",
          message: "TWELVE_DATA_API_KEY is not configured.",
        },
        500,
      );
    }

    const twelveDataUrl = new URL("https://api.twelvedata.com/time_series");
    twelveDataUrl.searchParams.set("symbol", symbol);
    twelveDataUrl.searchParams.set("interval", interval);
    twelveDataUrl.searchParams.set("outputsize", String(outputsize));
    twelveDataUrl.searchParams.set("apikey", apiKey);

    const twelveDataResponse = await fetch(twelveDataUrl);
    const rawData = await twelveDataResponse.json().catch(() => null);

    if (
      !twelveDataResponse.ok ||
      !rawData ||
      rawData.status === "error"
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "provider_error",
          message:
            rawData?.message ??
            "Twelve Data did not return valid market data.",
          provider_code: rawData?.code ?? null,
          provider_status: twelveDataResponse.status,
        },
        twelveDataResponse.status === 429 ? 429 : 502,
      );
    }

    const values = Array.isArray(rawData.values) ? rawData.values : [];
    const candles = values.map((value: Record<string, string>) => ({
      datetime: value.datetime,
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: value.volume !== undefined ? Number(value.volume) : null,
    }));

    return jsonResponse({
      ok: true,
      provider: "twelve_data",
      symbol,
      interval,
      meta: rawData.meta ?? null,
      latest: candles[0] ?? null,
      candles,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("market-data error:", error);
    return jsonResponse(
      {
        ok: false,
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      500,
    );
  }
});
