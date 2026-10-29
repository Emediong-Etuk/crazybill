// Runs the full LIVE pipeline on both samples and saves public/samples/<id>.result.json,
// which the app replays when the live service is busy. Usage: npm run precompute-samples
import { readFileSync, writeFileSync } from "node:fs";
import { requireEnv } from "./env";
import { runAudit } from "../src/lib/audit";
import { extractDocument } from "../src/lib/extract";
import { SAMPLES } from "../src/lib/samples";
import type { AuditEvent } from "../src/lib/schemas";
import type { SampleCache } from "../src/lib/sample-cache";

async function main() {
  requireEnv("NEBIUS_API_KEY", "TAVILY_API_KEY");
  let failed = 0;
  for (const s of SAMPLES) {
    console.log(`\n▶ ${s.id}`);
    const img = readFileSync(`public${s.image}`);
    const { doc, trace: extractTrace } = await extractDocument(img, "image/png");
    console.log(`  extracted: ${doc.docType}, band ${doc.tariffBand}, kWh ${doc.kWhBilled ?? doc.tokenUnitsKWh}, rate ${doc.ratePerKWh}`);
    const events: AuditEvent[] = [];
    const run = await runAudit({
      doc,
      ctx: s.context,
      emit: (e) => {
        if (e.type === "step" || e.type === "tool") events.push(e);
        if (e.type === "tool") console.log(`  · ${e.summary}`);
      },
    });
    const result = {
      ...run.result,
      trace: [...extractTrace, ...run.result.trace],
      totals: {
        latencyMs: run.result.totals.latencyMs + extractTrace.reduce((a, t) => a + t.latencyMs, 0),
        estCostUsd: run.result.totals.estCostUsd + extractTrace.reduce((a, t) => a + (t.estCostUsd ?? 0), 0),
      },
    };
    if (!run.liveOk) {
      failed++;
      console.error(`  ✗ live run incomplete (${run.researchError ?? "letter/pidgin failed"}) — NOT saving`);
      continue;
    }
    const cache: SampleCache = { savedAt: new Date().toISOString(), doc, context: s.context, events, result };
    writeFileSync(`public/samples/${s.id}.result.json`, JSON.stringify(cache, null, 2));
    console.log(`  ✓ ${result.verdict} · ₦${result.overcharge.totalNaira} · ${result.sources.length} sources · saved`);
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
