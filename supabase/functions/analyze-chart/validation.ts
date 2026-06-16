// Deterministische Validierung der Modellantwort. Niemals ungeprueft uebernehmen.
// Unterscheidet:
//   - "invalid"  -> Geometrie/Logik kaputt  -> Reparaturversuch, sonst failed
//   - "no_trade" -> geometrisch ok, aber RR ausserhalb [minRR, maxRR]
//                   ODER vom Modell als no_trade geliefert -> Level entfernen
//   - "insufficient_data" -> Level entfernen
//   - "valid"    -> ausfuehrbares Setup, Level konsistent, RR im Bereich
import { computeRR } from "./risk.ts";

export type Outcome = "valid" | "no_trade" | "insufficient_data" | "invalid";

export interface ValidationResult {
  outcome: Outcome;
  errors: string[];
  rr: number | null;
  patched: any;
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function stripLevels(setup: any) {
  setup.direction = "none";
  setup.entry_type = "none";
  setup.entry = null;
  setup.entry_zone_low = null;
  setup.entry_zone_high = null;
  setup.stop_loss = null;
  setup.take_profit_1 = null;
  setup.take_profit_2 = null;
}

export function validateModelResult(model: any, minRR: number, maxRR: number): ValidationResult {
  const errors: string[] = [];
  if (!model || typeof model !== "object" || !model.setup || typeof model.setup !== "object") {
    return { outcome: "invalid", errors: ["setup fehlt oder ist kein Objekt"], rr: null, patched: model };
  }
  const setup = model.setup;
  const status = setup.status;

  // --- Nicht ausfuehrbare Zustaende: Level erzwingen-leer ---
  if (status === "insufficient_data" || status === "no_trade") {
    stripLevels(setup);
    if (!Array.isArray(setup.no_trade_reasons)) setup.no_trade_reasons = [];
    if (!Array.isArray(setup.warnings)) setup.warnings = [];
    return { outcome: status, errors, rr: null, patched: model };
  }

  if (status !== "valid") {
    return { outcome: "invalid", errors: ["unbekannter setup.status"], rr: null, patched: model };
  }

  // --- status === 'valid' : strenge Geometrie-/Logikpruefung ---
  const dir = setup.direction;
  if (dir !== "long" && dir !== "short") errors.push("direction muss long oder short sein");

  // Entry bestimmen (echtes Entry oder Mittelpunkt einer vollstaendigen Zone)
  const hasZone = isFiniteNum(setup.entry_zone_low) && isFiniteNum(setup.entry_zone_high);
  let entry: number | null = isFiniteNum(setup.entry) ? setup.entry : null;
  if (entry == null && hasZone) entry = (setup.entry_zone_low + setup.entry_zone_high) / 2;

  const sl = isFiniteNum(setup.stop_loss) ? setup.stop_loss : null;
  const tp1 = isFiniteNum(setup.take_profit_1) ? setup.take_profit_1 : null;
  const tp2 = isFiniteNum(setup.take_profit_2) ? setup.take_profit_2 : null;

  if (entry == null) errors.push("kein gueltiger Entry/Entry-Zone");
  if (sl == null) errors.push("kein gueltiger Stop-Loss");
  if (tp1 == null) errors.push("kein gueltiger Take-Profit 1");

  // Alle relevanten Werte endlich und positiv
  for (const [name, v] of [["entry", entry], ["stop_loss", sl], ["take_profit_1", tp1]] as [string, number | null][]) {
    if (v != null && !(v > 0)) errors.push(name + " muss > 0 sein");
  }

  // Entry-Zone sortiert + SL ausserhalb der Zone
  if (hasZone) {
    if (!(setup.entry_zone_low <= setup.entry_zone_high)) errors.push("Entry-Zone ist nicht logisch sortiert");
    if (sl != null && setup.entry_zone_low <= sl && sl <= setup.entry_zone_high) errors.push("SL liegt innerhalb der Entry-Zone");
  }

  // Richtungslogik
  if (entry != null && sl != null && tp1 != null && (dir === "long" || dir === "short")) {
    if (dir === "long") {
      if (!(sl < entry)) errors.push("Long: SL muss < Entry sein");
      if (!(tp1 > entry)) errors.push("Long: TP1 muss > Entry sein");
      if (tp2 != null && !(tp2 > entry)) errors.push("Long: TP2 muss > Entry sein");
    } else {
      if (!(sl > entry)) errors.push("Short: SL muss > Entry sein");
      if (!(tp1 < entry)) errors.push("Short: TP1 muss < Entry sein");
      if (tp2 != null && !(tp2 < entry)) errors.push("Short: TP2 muss < Entry sein");
    }
  }

  if (errors.length) {
    return { outcome: "invalid", errors, rr: null, patched: model };
  }

  // RR selbst berechnen
  const rr = computeRR(entry as number, sl as number, tp1 as number);
  if (rr == null) {
    return { outcome: "invalid", errors: ["RR nicht berechenbar"], rr: null, patched: model };
  }

  // RR-Bereich pruefen -> ausserhalb => no_trade (kein Fehler, kein erfundener Preis)
  if (rr < minRR || rr > maxRR) {
    stripLevels(setup);
    setup.status = "no_trade";
    if (!Array.isArray(setup.no_trade_reasons)) setup.no_trade_reasons = [];
    setup.no_trade_reasons.push(
      "Kein Ziel mit RR im erlaubten Bereich (min " + minRR.toFixed(2) + " / max " + maxRR.toFixed(2) + "). Berechnetes RR: " + rr.toFixed(2) + ".",
    );
    if (!Array.isArray(setup.warnings)) setup.warnings = [];
    return { outcome: "no_trade", errors, rr: null, patched: model };
  }

  return { outcome: "valid", errors, rr, patched: model };
}
