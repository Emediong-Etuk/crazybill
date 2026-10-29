import { models, nebius, tavilyKey } from "@/lib/config";
import { tavilyPing } from "@/lib/tavily";

export async function GET() {
  const status: { nebius: "ok" | "error"; tavily: "ok" | "error"; models: Record<string, string | boolean> } = {
    nebius: "error",
    tavily: "error",
    models: { vision: models.vision, reason: models.reason, fast: models.fast },
  };
  if (nebius.apiKey) {
    try {
      const res = await fetch(`${nebius.baseUrl}models`, {
        headers: { Authorization: `Bearer ${nebius.apiKey}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.ok) {
        status.nebius = "ok";
        const ids = new Set(((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? []);
        status.models.visionAvailable = ids.has(models.vision);
        status.models.reasonAvailable = ids.has(models.reason);
        status.models.fastAvailable = ids.has(models.fast);
      }
    } catch {
      /* stays "error" */
    }
  }
  if (tavilyKey()) {
    try {
      if (await tavilyPing()) status.tavily = "ok";
    } catch {
      /* stays "error" */
    }
  }
  const ok = status.nebius === "ok" && status.tavily === "ok";
  return Response.json(status, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
