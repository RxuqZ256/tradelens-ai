// OpenAI Responses API – Bildinput + strikt strukturierte JSON-Ausgabe.
// Verifiziertes Format (Stand 2026):
//   POST https://api.openai.com/v1/responses
//   body.input = [{ role, content:[{type:"input_text"|"input_image", ...}] }]
//   input_image.image_url = vollqualifizierte URL ODER data-URL (+ optional detail)
//   Strukturierte Ausgabe ueber body.text.format = {type:"json_schema", name, schema, strict}
//   Antwort in output[] -> item.type==="message" -> content[].type==="output_text" -> .text
//   Refusal als content[].type==="refusal".
// Provider-Abstraktion: gemeinsames Interface fuer spaetere Anbieter.

export interface VisionRequest {
  imageUrl: string; // kurzlebige Signed URL (nur Transport, nie speichern/loggen)
  systemPrompt: string;
  userPrompt: string;
  schema: unknown;
  schemaName: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export interface VisionResult {
  json: any;
  raw_status: number;
}

export interface VisionProvider {
  name: string;
  analyze(req: VisionRequest): Promise<VisionResult>;
}

function extractOutputText(data: any): { text: string | null; refusal: string | null } {
  // Bevorzugt das standardisierte output[]-Array auswerten.
  let text: string | null = null;
  let refusal: string | null = null;
  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c?.type === "output_text" && typeof c.text === "string") {
            text = (text ?? "") + c.text;
          } else if (c?.type === "refusal" && typeof c.refusal === "string") {
            refusal = c.refusal;
          }
        }
      }
    }
  }
  // Fallback: manche Implementierungen liefern output_text als Komfortfeld.
  if (text == null && typeof data?.output_text === "string") text = data.output_text;
  return { text, refusal };
}

export const openAIProvider: VisionProvider = {
  name: "openai",
  async analyze(req: VisionRequest): Promise<VisionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const body = {
        model: req.model,
        input: [
          { role: "system", content: [{ type: "input_text", text: req.systemPrompt }] },
          {
            role: "user",
            content: [
              { type: "input_text", text: req.userPrompt },
              { type: "input_image", image_url: req.imageUrl, detail: "high" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: req.schemaName,
            schema: req.schema,
            strict: true,
          },
        },
      };

      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + req.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const status = resp.status;
      if (!resp.ok) {
        // Keine sensiblen Header/Keys loggen – nur Status + Kurztext.
        let detail = "";
        try { detail = (await resp.text()).slice(0, 300); } catch (_e) { /* ignore */ }
        throw new Error("provider_http_" + status + (detail ? (": " + detail) : ""));
      }

      const data = await resp.json();
      const { text, refusal } = extractOutputText(data);
      if (refusal) throw new Error("model_refusal");
      if (!text) throw new Error("empty_model_output");

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (_e) {
        throw new Error("model_output_not_json");
      }
      return { json: parsed, raw_status: status };
    } finally {
      clearTimeout(timer);
    }
  },
};
