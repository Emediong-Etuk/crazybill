// Central configuration. Env is read lazily so scripts can load .env.local first.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() !== "" ? raw.trim() : fallback;
}

export const models = {
  get vision() {
    return str("MODEL_VISION", "nvidia/Nemotron-3.5-Super-VL");
  },
  get visionFallback() {
    return str("MODEL_VISION_FALLBACK", "nvidia/Nemotron-3-Nano-Omni");
  },
  get reason() {
    return str("MODEL_REASON", "nvidia/Nemotron-3-Ultra-550b-a55b");
  },
  get fast() {
    return str("MODEL_FAST", "nvidia/Nemotron-3_5-Lightning");
  },
};

export const nebius = {
  get baseUrl() {
    const u = str("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1/");
    return u.endsWith("/") ? u : `${u}/`;
  },
  get apiKey() {
    return process.env.NEBIUS_API_KEY ?? "";
  },
};

export const tavilyKey = () => process.env.TAVILY_API_KEY ?? "";

export const limits = {
  get ratePerHour() {
    return num("RATE_LIMIT_PER_HOUR", 20);
  },
  get dailyLiveAuditCap() {
    return num("DAILY_LIVE_AUDIT_CAP", 300);
  },
  maxUploadBytes: 4 * 1024 * 1024,
  // Agent budget (spec §10). Cut to 4 tool calls if the host caps maxDuration at 60s.
  get agentMaxToolCalls() {
    return num("AGENT_MAX_TOOL_CALLS", 8);
  },
  agentMaxTurns: 6,
  get agentTimeoutMs() {
    return num("AGENT_TIMEOUT_MS", 150_000);
  },
};

export const vatRateHint = () => num("VAT_RATE_HINT", 0.075);

// Tolerances for deterministic checks (spec §9).
export const tolerance = {
  moneyAbs: 50,
  moneyRel: 0.01,
  kwhAbs: 1,
  kwhRel: 0.01,
};

// USD per 1M tokens [input, output]. Approximate, from the Token Factory price list (Oct 2026).
// Override with PRICE_<KEY>_IN / PRICE_<KEY>_OUT, e.g. PRICE_ULTRA_IN=1.2
type PriceKey = "LIGHTNING" | "NANO_OMNI" | "SUPER_VL" | "ULTRA";
const DEFAULT_PRICES: Record<PriceKey, [number, number]> = {
  LIGHTNING: [0.06, 0.24],
  NANO_OMNI: [0.06, 0.24],
  SUPER_VL: [0.3, 0.9],
  ULTRA: [1.0, 3.0],
};

function priceKeyFor(model: string): PriceKey | null {
  const m = model.toLowerCase();
  if (m.includes("ultra")) return "ULTRA";
  if (m.includes("lightning")) return "LIGHTNING";
  if (m.includes("omni") || m.includes("nano")) return "NANO_OMNI";
  if (m.includes("super") || m.includes("vl")) return "SUPER_VL";
  return null;
}

export function priceFor(model: string): { input: number; output: number } | null {
  const key = priceKeyFor(model);
  if (!key) return null;
  const [i, o] = DEFAULT_PRICES[key];
  return { input: num(`PRICE_${key}_IN`, i), output: num(`PRICE_${key}_OUT`, o) };
}

export function estimateCostUsd(
  model: string,
  promptTokens?: number,
  completionTokens?: number,
): number | undefined {
  const p = priceFor(model);
  if (!p || promptTokens === undefined) return undefined;
  return (promptTokens * p.input + (completionTokens ?? 0) * p.output) / 1_000_000;
}

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const repoUrl = () => process.env.NEXT_PUBLIC_REPO_URL || "";
