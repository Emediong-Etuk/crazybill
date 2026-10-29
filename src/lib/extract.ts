import { capabilitiesFor } from "./capabilities";
import { models } from "./config";
import { parseJson } from "./json";
import { callModel, LlmError, schemaInstruction } from "./llm";
import { modelRepair } from "./repair";
import { ExtractedDocSchema, type ExtractedDoc, type TraceEntry } from "./schemas";

export const EXTRACT_SYSTEM_PROMPT = `You read photos of Nigerian electricity documents: postpaid bills from Distribution
Companies (DisCos) and prepaid token vending receipts. Extract fields exactly as printed.

Rules:
- Output ONLY one JSON object matching the schema. Use null for anything not visible.
- Never guess or calculate a missing value. Calculations happen later in code.
- Numbers: remove ₦, "N", "NGN", commas and spaces → plain number ("1,234.50" → 1234.5).
  Values in brackets are negative: "(1,200.00)" → -1200.
- docType: "prepaid_token" if it shows units/kWh purchased or a token; "postpaid_bill" if it
  shows meter readings, arrears, or amount due; otherwise "unknown".
- readType: "E", "EST", "Estimated" → "estimated"; "A", "ACT", "Actual", "Normal" → "actual".
- tariffBand: single letter A–E if a band is printed ("Band A", "Service Band: B", "A-NMD").
  tariffClass: the tariff code exactly as printed.
- NEVER output the token number itself (the 20-digit code). Ignore it completely.
- fieldConfidence: for every non-null field, "high" (clearly legible), "medium"
  (partly legible), or "low" (blurry/ambiguous).
- unreadableFields: names of fields that are present on the document but not legible.`;

const FIELD_GUIDE = `Field names: docType, disco, customerName, address, accountOrMeterNo, tariffClass, tariffBand,
billingPeriod, billDate, readType, meterMultiplier, previousReading, presentReading, kWhBilled,
ratePerKWh, energyCharge, vat, balanceBroughtForward, payments, adjustments, otherCharges, totalDue,
amountPaid, tokenUnitsKWh, debtDeduction, vendDate, fieldConfidence, unreadableFields, notes.`;

async function extractWith(model: string, dataUrl: string, trace: TraceEntry[], note?: string): Promise<ExtractedDoc> {
  const promptOnly = capabilitiesFor(model).jsonMode === "prompt";
  const { content } = await callModel({
    step: "extract",
    model,
    trace,
    note,
    temperature: 0,
    thinking: false,
    maxTokens: 2500,
    timeoutMs: 55_000,
    responseSchema: ExtractedDocSchema,
    messages: [
      {
        role: "system",
        content: `${EXTRACT_SYSTEM_PROMPT}\n\n${FIELD_GUIDE}${promptOnly ? `\n\n${schemaInstruction(ExtractedDocSchema)}` : ""}`,
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "Extract the fields." },
        ],
      },
    ],
  });
  return parseJson(content, ExtractedDocSchema, modelRepair(ExtractedDocSchema, trace));
}

/** Reads a document image with MODEL_VISION, falling back to MODEL_VISION_FALLBACK on error. */
export async function extractDocument(
  image: Buffer,
  mimeType: string,
): Promise<{ doc: ExtractedDoc; trace: TraceEntry[] }> {
  const trace: TraceEntry[] = [];
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
  let doc: ExtractedDoc;
  try {
    doc = await extractWith(models.vision, dataUrl, trace);
  } catch (e) {
    if (e instanceof LlmError && e.kind === "config") throw e;
    doc = await extractWith(models.visionFallback, dataUrl, trace, "fallback model");
  }
  return { doc: sanitize(doc), trace };
}

/** Defensive clean-up of model output. */
function sanitize(doc: ExtractedDoc): ExtractedDoc {
  const d = { ...doc };
  // Never keep anything that looks like a 20-digit token.
  if (d.accountOrMeterNo && d.accountOrMeterNo.replace(/\D/g, "").length >= 19) d.accountOrMeterNo = null;
  if (d.notes) d.notes = d.notes.replace(/\b(?:\d[\s-]?){16,}\b/g, "[token removed]").slice(0, 400);
  const conf = { ...d.fieldConfidence };
  for (const k of Object.keys(conf)) if ((d as Record<string, unknown>)[k] === null) delete conf[k];
  d.fieldConfidence = conf;
  return d;
}
