import { z } from "zod";

// ---------- lenient coercion helpers (model output is messy) ----------

/** "₦1,234.50" → 1234.5, "(1,200.00)" → -1200, "" / "N/A" → null. */
export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/₦|NGN|kwh|\bN(?=[\d\s.,-])|,|\s/gi, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const num = z.preprocess(toNumberOrNull, z.number().nullable());

const str = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : typeof v === "number" ? String(v) : null),
  z.string().nullable(),
);

export const BANDS = ["A", "B", "C", "D", "E"] as const;
export const BandSchema = z.enum(BANDS);
export type Band = z.infer<typeof BandSchema>;

export function toBandOrNull(v: unknown): Band | null {
  if (typeof v !== "string") return null;
  const m = v.trim().toUpperCase().match(/^(?:SERVICE\s*)?(?:BAND\s*[:\-]?\s*)?([A-E])(?:\b|\d|-|$)/);
  return m ? (m[1] as Band) : null;
}

const band = z.preprocess(toBandOrNull, BandSchema.nullable());

const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

const lowerEnum = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.enum(values).catch(fallback));

const stringArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => String(x).trim()) : []),
  z.array(z.string()),
);

// ---------- extraction ----------

export const ExtractedDocSchema = z.object({
  docType: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[\s-]+/g, "_") : v),
    z.enum(["postpaid_bill", "prepaid_token", "unknown"]).catch("unknown"),
  ),
  disco: str,
  customerName: str,
  address: str,
  accountOrMeterNo: str,
  tariffClass: str,
  tariffBand: band,
  billingPeriod: str,
  billDate: str,
  readType: z.preprocess((v) => {
    if (typeof v !== "string") return null;
    const s = v.trim().toLowerCase();
    if (["e", "est", "estimated", "estimate"].includes(s)) return "estimated";
    if (["a", "act", "actual", "normal", "metered"].includes(s)) return "actual";
    return null;
  }, z.enum(["actual", "estimated"]).nullable()),
  meterMultiplier: num,
  previousReading: num,
  presentReading: num,
  kWhBilled: num,
  ratePerKWh: num,
  energyCharge: num,
  vat: num,
  balanceBroughtForward: num,
  payments: num,
  adjustments: num,
  otherCharges: num,
  totalDue: num,
  amountPaid: num,
  tokenUnitsKWh: num,
  debtDeduction: num,
  vendDate: str,
  fieldConfidence: z.preprocess((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, c] of Object.entries(v as Record<string, unknown>)) {
      if (typeof c === "string" && ["high", "medium", "low"].includes(c.toLowerCase())) out[k] = c.toLowerCase();
    }
    return out;
  }, z.record(z.string(), Confidence)),
  unreadableFields: stringArray,
  notes: str,
});
export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

export const NUMERIC_DOC_FIELDS = [
  "meterMultiplier",
  "previousReading",
  "presentReading",
  "kWhBilled",
  "ratePerKWh",
  "energyCharge",
  "vat",
  "balanceBroughtForward",
  "payments",
  "adjustments",
  "otherCharges",
  "totalDue",
  "amountPaid",
  "tokenUnitsKWh",
  "debtDeduction",
] as const satisfies readonly (keyof ExtractedDoc)[];

export const emptyDoc = (): ExtractedDoc => ExtractedDocSchema.parse({});

// ---------- user context ----------

export const MeterSituationSchema = z.enum(["prepaid_meter", "postpaid_meter", "no_meter", "unsure"]);

export const UserContextSchema = z.object({
  disco: z.string().min(1).max(80),
  avgHoursPerDay: z.number().min(0).max(24),
  daysAtThisLevel: z.number().int().min(1).max(90),
  meterSituation: MeterSituationSchema,
  notes: z.string().max(300).optional(),
});
export type UserContext = z.infer<typeof UserContextSchema>;

// ---------- deterministic checks ----------

export type CheckId = "reading_diff" | "energy_charge" | "vat_rate" | "bill_total" | "token_units" | "estimated_read";
export type CheckResult = {
  id: CheckId;
  label: string;
  expected: number | null;
  actual: number | null;
  diff: number | null;
  status: "pass" | "fail" | "skipped" | "info";
  explanation: string;
};

// ---------- agent output ----------

const sourceUrl = z.preprocess(
  (v) => (typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : null),
  z.string().nullable(),
);
const urlArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^https?:\/\//i.test(x)) : []),
  z.array(z.string()),
);
const reqString = z.preprocess((v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v)), z.string());
const nonEmpty = z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().min(1));
const reqNumber = z.preprocess(toNumberOrNull, z.number());

export const TariffLookupSchema = z.object({
  disco: reqString,
  band: z.preprocess(toBandOrNull, BandSchema),
  ratePerKWh: reqNumber,
  effectiveFrom: str,
  sourceUrl: sourceUrl,
  sourceTitle: reqString,
  evidence: reqString,
  confidence: lowerEnum(["high", "medium", "low"], "medium").optional(),
});

/** Drops array items that fail validation instead of failing the whole object. */
function lenientArray<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((x) => item.safeParse(x).success) : []),
    z.array(item),
  );
}

export const FindingSchema = z.object({
  id: reqString,
  title: nonEmpty,
  explanation: nonEmpty,
  rule: reqString,
  sourceUrl: sourceUrl,
  severity: lowerEnum(["high", "medium", "low"], "medium"),
  confidence: lowerEnum(["high", "medium", "low"], "low"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AgentOutputSchema = z.object({
  tariffLookups: lenientArray(TariffLookupSchema),
  serviceLevels: lenientArray(
    z.object({ band: z.preprocess(toBandOrNull, BandSchema), minHoursPerDay: reqNumber, sourceUrl: sourceUrl }),
  ),
  bandAssessment: z
    .object({
      billedBand: str,
      minHoursBilledBand: num,
      reportedAvgHours: z.preprocess(toNumberOrNull, z.number().nullable()),
      daysAtThisLevel: z.preprocess(toNumberOrNull, z.number().nullable()),
      bandSupportedByHours: band,
      downgradeRuleApplies: z.preprocess((v) => v === true || v === "true", z.boolean()),
      reasoning: reqString,
      sourceUrls: urlArray,
    })
    .nullable()
    .catch(null),
  estimatedBillingAssessment: z
    .object({
      applies: z.preprocess((v) => v === true || v === "true", z.boolean()),
      reasoning: reqString,
      sourceUrls: urlArray,
    })
    .nullable()
    .catch(null),
  findings: lenientArray(FindingSchema),
  remedies: stringArray,
  escalationPath: lenientArray(
    z.object({ step: nonEmpty, body: reqString, timeline: str, sourceUrl: sourceUrl }),
  ),
  missingInfo: stringArray,
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export type TariffLookup = z.infer<typeof TariffLookupSchema>;

export const emptyAgentOutput = (): AgentOutput => AgentOutputSchema.parse({});

// ---------- trace + result ----------

export type TraceStep = "extract" | "research" | "repair" | "letter" | "pidgin";
export type TraceEntry = {
  step: TraceStep;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  toolCalls?: { name: string; summary: string }[];
  estCostUsd?: number;
  ok: boolean;
  error?: string;
  note?: string;
};

export type Verdict = "likely_overcharged" | "possible_issues" | "looks_fine" | "needs_info";

export type OverchargeLine = { label: string; naira: number; formula: string; kind: "arithmetic" | "tariff" };
export type Overcharge = { totalNaira: number; breakdown: OverchargeLine[] };

export type Source = { url: string; title: string; usedFor: string };

export type AuditResult = {
  verdict: Verdict;
  summary: string;
  overcharge: Overcharge;
  checks: CheckResult[];
  agent: AgentOutput;
  letter: string;
  pidgin: string;
  sources: Source[];
  tavilyQueries: string[];
  trace: TraceEntry[];
  totals: { latencyMs: number; estCostUsd: number };
  meta: { disco: string; maskedAccount: string | null; docType: ExtractedDoc["docType"]; generatedAt: string };
  cached?: { savedAt: string };
};

// ---------- streaming events ----------

export type StepId = "checks" | "research" | "compute" | "letter";
export type AuditEvent =
  | { type: "step"; id: StepId; status: "start" | "done" | "error"; label: string }
  | { type: "tool"; name: "tavily_search" | "tavily_extract" | "calc"; summary: string }
  | { type: "notice"; message: string; replay?: boolean }
  | { type: "result"; data: AuditResult }
  | { type: "error"; message: string; recoverable: boolean };

export const AuditRequestSchema = z.object({
  doc: ExtractedDocSchema,
  context: UserContextSchema,
  sampleId: z.enum(["postpaid-estimated", "token-receipt"]).optional(),
});
export type AuditRequest = z.infer<typeof AuditRequestSchema>;

/** JSON Schema for prompts / response_format. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }) as Record<string, unknown>;
}
