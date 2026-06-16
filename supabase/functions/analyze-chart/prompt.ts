// Prompt-Bau fuer die ICT-Single-Chart-Analyse.
// Kein Chain-of-Thought anfordern. Nur kurze, ueberpruefbare Begruendungen
// und Evidence-Felder. Keine HTML-Ausgabe. Striktes JSON gemaess Schema.

export const PROMPT_VERSION = Deno.env.get("AI_PROMPT_VERSION") ?? "ict-single-chart-v1";

export const ALLOWED_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"] as const;

export interface PromptSettings {
  signal_type: string;
  rr_target: number;
  min_rr: number;
  max_rr: number;
}

export interface ConfirmedInput {
  instrument?: string | null;
  timeframe?: string | null;
}

export function buildSystemPrompt(): string {
  return [
    "Du bist ein praeziser ICT-Trading-Analyst. Du analysierst AUSSCHLIESSLICH genau einen einzelnen Chart-Screenshot.",
    "Du gibst NUR striktes JSON gemaess dem vorgegebenen Schema aus. Kein Text davor oder danach, kein Markdown, kein HTML.",
    "Du lieferst keine schrittweise Gedankenkette. Begruendungen sind kurz und ueberpruefbar; Evidence-Eintraege benennen knapp das sichtbare Merkmal.",
    "",
    "Grundregeln:",
    "- Analysiere nur, was im Screenshot sichtbar oder als bestaetigte Nutzereingabe vorhanden ist.",
    "- Erfinde keine Live-Marktdaten, keine Preise und keine Strukturen, die nicht sichtbar sind. Unbekannte Preisfelder = null.",
    "- Kein fest vorgegebener bullischer oder baerischer Bias.",
    "- htf_bias darf nur 'bullish'/'bearish' sein, wenn ein hoeherer Timeframe sichtbar/bestaetigt ist; sonst 'unavailable' oder 'unconfirmed'.",
    "- Erzwinge niemals einen Trade. Wenn kein sauberes Setup vorliegt: setup.status='no_trade'. Bei unlesbarem Chart/Symbol/Timeframe/Achse: setup.status='insufficient_data'.",
    "- Keine Gewinnversprechen, keine Garantien.",
    "- Entry ist NICHT automatisch der aktuelle Preis. entry_type: 'market' nur wenn das Setup aktiv und der Preis nicht zu weit gelaufen ist; 'limit' bei geplantem Ruecklauf in FVG/Discount/Premium/Strukturzone; 'stop' wenn eine Bestaetigung (BOS/CHoCH/Breakout) noetig ist; sonst 'none'.",
    "",
    "Analysegrundlage (4 ICT-Saeulen, nur sichtbar Belegbares):",
    "1) Struktur: HH/HL/LH/LL, BOS, CHoCH, Trend/Range, struktureller Invalidierungspunkt.",
    "2) Liquiditaet: BSL/SSL, Equal Highs/Lows, gesweepte vs. offene Liquiditaet, wahrscheinlichstes sichtbares Ziel.",
    "3) Fair Value Gap / Imbalance: bullish/bearish, mitigiert/teilweise/nicht mitigiert, oder keiner.",
    "4) Premium/Discount: sichtbare Dealing Range, Range High/Low, Equilibrium 50%, Premium/Discount/near_eq.",
    "",
    "Du berechnest KEINE Lotgroesse, kein Geldrisiko und keinen Gewinn. Diese Werte ergaenzt die Anwendung serverseitig.",
    "Gib bei 'no_trade' und 'insufficient_data' immer direction='none', entry_type='none' und alle Trade-Level=null aus.",
  ].join("\n");
}

export function buildUserPrompt(
  s: PromptSettings,
  confirmed: ConfirmedInput,
  repairErrors?: string[],
): string {
  const lines: string[] = [];
  lines.push("Analysiere den beigefuegten einzelnen Chart-Screenshot.");
  lines.push("");
  lines.push("Gespeicherte Nutzereinstellungen (serverseitig, verbindlich):");
  lines.push("- selected_user_style (signal_type): " + s.signal_type);
  lines.push("- effektives Mindest-RR: " + s.min_rr.toFixed(2));
  lines.push("- maximales Ziel-RR: " + s.max_rr.toFixed(2));
  lines.push("Regeln zum Stil: Passe Analyse-Horizont an den erkannten Timeframe an (M1-M5 Scalping, M15-M30 Intraday, H1-H4 Day/Swing, D1-W1 Swing/Position).");
  lines.push("Der gespeicherte signal_type ist wichtiger als die automatische Ableitung. Bei schlechter Passung setze context.style_match entsprechend und ergaenze eine kurze Warnung in setup.warnings.");
  lines.push("Waehle ein Take-Profit-Ziel so, dass das berechenbare RR (TP1) zwischen dem Mindest-RR und dem maximalen Ziel-RR liegt. Ist das strukturell nicht moeglich, setze setup.status='no_trade'.");

  const cInstr = (confirmed.instrument || "").trim();
  const cTf = (confirmed.timeframe || "").trim();
  if (cInstr || cTf) {
    lines.push("");
    lines.push("Vom Nutzer ausdruecklich BESTAETIGTE Angaben (als Wahrheit behandeln):");
    if (cInstr) lines.push("- bestaetigtes Instrument: " + cInstr);
    if (cTf) lines.push("- bestaetigter Timeframe: " + cTf);
    lines.push("Uebernimm diese Werte in chart.instrument bzw. chart.timeframe mit hoher Konfidenz und setze chart.needs_user_confirmation=false, sofern nur diese Angaben unsicher waren.");
  }

  if (repairErrors && repairErrors.length) {
    lines.push("");
    lines.push("Deine vorherige Antwort war ungueltig. Korrigiere ausschliesslich diese Punkte und liefere erneut striktes JSON gemaess Schema:");
    for (const e of repairErrors) lines.push("- " + e);
    lines.push("Erfinde dabei keine Preise. Wenn kein konsistentes, regelkonformes Setup moeglich ist, liefere setup.status='no_trade' mit Begruendung.");
  }

  lines.push("");
  lines.push("Gib jetzt ausschliesslich das JSON-Objekt gemaess Schema zurueck.");
  return lines.join("\n");
}
