// Striktes JSON-Schema fuer die Modellausgabe (OpenAI Responses API: text.format).
// WICHTIG (Strict Mode): nur unterstuetzte Keywords verwenden
//   (type, enum, properties, required, additionalProperties, items).
//   KEINE minimum/maximum/min-/maxLength/pattern/format -> Wertebereiche
//   werden deterministisch in validation.ts geprueft.
// Jedes Objekt: additionalProperties:false und ALLE Properties in "required".
// Alle Preisfelder duerfen null sein (type: ["number","null"]).

export const SCHEMA_VERSION = "1.0";

export const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "prompt_version", "chart", "context", "ict", "setup", "explanation"],
  properties: {
    schema_version: { type: "string", enum: ["1.0"] },
    prompt_version: { type: "string" },
    chart: {
      type: "object",
      additionalProperties: false,
      required: ["instrument", "instrument_confidence", "timeframe", "timeframe_confidence", "visible_price", "image_quality", "needs_user_confirmation", "limitations"],
      properties: {
        instrument: { type: ["string", "null"] },
        instrument_confidence: { type: "integer" },
        timeframe: { type: ["string", "null"], enum: ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", null] },
        timeframe_confidence: { type: "integer" },
        visible_price: { type: ["number", "null"] },
        image_quality: { type: "string", enum: ["good", "medium", "poor"] },
        needs_user_confirmation: { type: "boolean" },
        limitations: { type: "array", items: { type: "string" } },
      },
    },
    context: {
      type: "object",
      additionalProperties: false,
      required: ["detected_style", "selected_user_style", "style_match", "chart_bias", "htf_bias", "setup_horizon", "estimated_holding_period"],
      properties: {
        detected_style: { type: "string", enum: ["scalping", "day", "swing", "position"] },
        selected_user_style: { type: "string", enum: ["scalping", "day", "swing"] },
        style_match: { type: "string", enum: ["good", "medium", "poor"] },
        chart_bias: { type: "string", enum: ["bullish", "bearish", "ranging", "unclear"] },
        htf_bias: { type: "string", enum: ["bullish", "bearish", "unavailable", "unconfirmed"] },
        setup_horizon: { type: "string", enum: ["scalp", "intraday", "swing", "position"] },
        estimated_holding_period: { type: ["string", "null"] },
      },
    },
    ict: {
      type: "object",
      additionalProperties: false,
      required: ["structure", "liquidity", "fvg", "premium_discount"],
      properties: {
        structure: {
          type: "object",
          additionalProperties: false,
          required: ["state", "trend", "bos", "choch", "summary", "evidence"],
          properties: {
            state: { type: "string", enum: ["HH_HL", "LH_LL", "range", "unclear"] },
            trend: { type: "string", enum: ["bullish", "bearish", "ranging", "unclear"] },
            bos: { type: "boolean" },
            choch: { type: "boolean" },
            summary: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
        },
        liquidity: {
          type: "object",
          additionalProperties: false,
          required: ["swept", "open_targets", "primary_target", "summary", "evidence"],
          properties: {
            swept: { type: "array", items: { type: "string", enum: ["BSL", "SSL", "EQH", "EQL"] } },
            open_targets: { type: "array", items: { type: "string", enum: ["BSL", "SSL", "EQH", "EQL"] } },
            primary_target: { type: ["string", "null"], enum: ["BSL", "SSL", "EQH", "EQL", null] },
            summary: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
        },
        fvg: {
          type: "object",
          additionalProperties: false,
          required: ["type", "status", "zone_low", "zone_high", "summary", "evidence"],
          properties: {
            type: { type: "string", enum: ["bullish", "bearish", "none"] },
            status: { type: "string", enum: ["unmitigated", "partially_mitigated", "mitigated", "none"] },
            zone_low: { type: ["number", "null"] },
            zone_high: { type: ["number", "null"] },
            summary: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
        },
        premium_discount: {
          type: "object",
          additionalProperties: false,
          required: ["location", "range_high", "range_low", "equilibrium", "summary", "evidence"],
          properties: {
            location: { type: "string", enum: ["premium", "discount", "near_eq", "unclear"] },
            range_high: { type: ["number", "null"] },
            range_low: { type: ["number", "null"] },
            equilibrium: { type: ["number", "null"] },
            summary: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    setup: {
      type: "object",
      additionalProperties: false,
      required: ["status", "direction", "entry_type", "entry", "entry_zone_low", "entry_zone_high", "stop_loss", "take_profit_1", "take_profit_2", "target_liquidity", "entry_trigger", "invalidation", "setup_confidence", "no_trade_reasons", "warnings"],
      properties: {
        status: { type: "string", enum: ["valid", "no_trade", "insufficient_data"] },
        direction: { type: "string", enum: ["long", "short", "none"] },
        entry_type: { type: "string", enum: ["market", "limit", "stop", "none"] },
        entry: { type: ["number", "null"] },
        entry_zone_low: { type: ["number", "null"] },
        entry_zone_high: { type: ["number", "null"] },
        stop_loss: { type: ["number", "null"] },
        take_profit_1: { type: ["number", "null"] },
        take_profit_2: { type: ["number", "null"] },
        target_liquidity: { type: ["string", "null"] },
        entry_trigger: { type: "string" },
        invalidation: { type: "string" },
        setup_confidence: { type: "integer" },
        no_trade_reasons: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
    explanation: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "beginner_explanation", "ict_explanation"],
      properties: {
        summary: { type: "string" },
        beginner_explanation: { type: "string" },
        ict_explanation: { type: "string" },
      },
    },
  },
} as const;
