import { runAudit } from "@/lib/audit";
import { checkRateLimit, clientIp, takeDailyAudit } from "@/lib/rate-limit";
import { loadSampleCache, replaySample } from "@/lib/sample-cache";
import { AuditRequestSchema } from "@/lib/schemas";
import { ndjsonStream } from "@/lib/stream";

// If the Vercel plan rejects 300, set 60 and AGENT_MAX_TOOL_CALLS=4 (see DECISIONS.md).
export const maxDuration = 300;

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = AuditRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Some answers are missing or invalid.", 400);
  const { doc, context, sampleId } = parsed.data;
  const origin = new URL(req.url).origin;

  const rl = checkRateLimit(`audit:${clientIp(req)}`);
  const limited = !rl.ok ? `you've run a lot of audits — try again in about ${Math.ceil(rl.retryAfterSec / 60)} min` : null;
  const capped = !limited && !takeDailyAudit() ? "today's free live audits are used up" : null;

  if (limited || capped) {
    if (sampleId) {
      const cache = await loadSampleCache(sampleId, origin);
      if (cache) return ndjsonStream((emit) => replaySample(cache, emit, `live service is busy (${limited ?? capped}).`));
    }
    return jsonError(
      limited ? `Slow down a little — ${limited}.` : "Today's free live audits are used up. Please try again tomorrow, or try a sample.",
      429,
      !rl.ok ? { retryAfterSec: rl.retryAfterSec } : {},
    );
  }

  return ndjsonStream(async (emit, signal) => {
    if (!sampleId) {
      const run = await runAudit({ doc, ctx: context, emit, signal });
      if (!run.liveOk && run.researchError) {
        emit({ type: "notice", message: "The research step couldn't finish, so tariffs and NERC rules weren't checked. The maths checks below are still valid." });
      }
      emit({ type: "result", data: run.result });
      return;
    }
    // Samples: run live; if any live step fails, replay the saved run instead.
    let failed = false;
    try {
      const run = await runAudit({
        doc,
        ctx: context,
        signal,
        emit,
      });
      failed = !run.liveOk;
      if (!failed) {
        emit({ type: "result", data: run.result });
        return;
      }
    } catch {
      failed = true;
    }
    const cache = await loadSampleCache(sampleId, origin);
    if (cache) {
      await replaySample(cache, emit, "the live service is busy.");
    } else {
      emit({ type: "error", message: "The live service is busy and no saved run is available. Please try again shortly.", recoverable: true });
    }
  });
}
