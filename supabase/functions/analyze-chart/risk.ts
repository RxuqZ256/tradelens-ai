// Deterministische Risiko- und RR-Berechnung. KEINE Lotgroesse ohne
// verifizierte Instrumentspezifikation (kommt erst in Phase 4B).

export const MIN_RR_FLOOR = 1.8;
export const MAX_TARGET_RR = 4.0;

export interface RiskSettings {
  account_size: number | null;
  risk_percent: number | null;
  rr_target: number | null;
  auto_lot_calculation: boolean;
}

export interface RiskResult {
  risk_percent: number | null;
  risk_amount: number | null;
  rr_calculated: number | null;
  lot: null;
  lot_status: "instrument_specs_required" | "disabled";
}

export function effectiveMinRR(rrTarget: number | null | undefined): number {
  const t = Number(rrTarget);
  return Math.max(MIN_RR_FLOOR, Number.isFinite(t) ? t : 0);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeRiskAmount(accountSize: number | null, riskPercent: number | null): number | null {
  if (accountSize == null || riskPercent == null) return null;
  if (!Number.isFinite(accountSize) || !Number.isFinite(riskPercent)) return null;
  if (accountSize <= 0 || riskPercent <= 0) return null;
  return round2((accountSize * riskPercent) / 100);
}

// RR auf Basis von TP1: |TP - Entry| / |Entry - SL|
export function computeRR(entry: number, sl: number, tp: number): number | null {
  if (![entry, sl, tp].every((x) => Number.isFinite(x))) return null;
  const denom = Math.abs(entry - sl);
  if (denom === 0) return null;
  return round2(Math.abs(tp - entry) / denom);
}

export function buildRisk(s: RiskSettings, rrCalculated: number | null): RiskResult {
  return {
    risk_percent: s.risk_percent ?? null,
    risk_amount: computeRiskAmount(s.account_size, s.risk_percent),
    rr_calculated: rrCalculated,
    lot: null,
    lot_status: s.auto_lot_calculation === false ? "disabled" : "instrument_specs_required",
  };
}
