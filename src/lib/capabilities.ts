// Per-model capabilities. Written from `npm run probe` (scripts/probe.ts).
//
// STATUS: the values below are conservative DEFAULTS — the probe has not yet been
// run against the live Token Factory catalog (no API key / network in the build
// sandbox). Run `npm run probe -- --write` with real keys to overwrite this file.
// llm.ts also degrades at runtime (json_schema → json_object → prompt) if a mode
// is rejected, so wrong defaults cost one extra request, not a broken app.

export type JsonMode = "json_schema" | "json_object" | "prompt";
export type ThinkingSwitch =
  | "none" // no switch known; reasoning (if any) is stripped from output
  | "chat_template_kwargs" // extra body { chat_template_kwargs: { enable_thinking } }
  | "system_flag"; // "/think" or "/no_think" line in the system prompt

export type ModelCapabilities = {
  jsonMode: JsonMode;
  supportsTools: boolean;
  supportsVision: boolean;
  thinkingSwitch: ThinkingSwitch;
  verified: boolean;
  latencyMs?: number;
};

export const PROBED_AT: string | null = null;

export const CAPABILITIES: Record<string, ModelCapabilities> = {};

const DEFAULT: ModelCapabilities = {
  jsonMode: "json_object",
  supportsTools: true,
  supportsVision: false,
  thinkingSwitch: "none",
  verified: false,
};

export function capabilitiesFor(model: string): ModelCapabilities {
  return CAPABILITIES[model] ?? DEFAULT;
}
