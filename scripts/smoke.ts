// End-to-end smoke test on both samples against the LIVE APIs.
// Usage: npm run smoke                       → in-process pipeline (needs keys in .env.local)
//        npm run smoke -- --url https://…    → through a deployed app's /api/extract + /api/audit
import { readFileSync } from "node:fs";
import { requireEnv } from "./env";
import { runAudit } from "../src/lib/audit";
import { extractDocument } from "../src/lib/extract";
import { formatMs, formatUsd } from "../src/lib/format";
import { SAMPLES } from "../src/lib/samples";
import type { AuditEvent, AuditResult, ExtractedDoc, TraceEntry } from "../src/lib/schemas";
import { readNdjson } from "../src/lib/stream";

const urlArg = process.argv.indexOf("--url");
const baseUrl = urlArg > -1 ? process.argv[urlArg + 1]?.replace(/\/$/, "") : undefined;

async function viaHttp(id: string, img: Buffer, ctx: unknown): Promise<{ result: AuditResult; extractTrace: TraceEntry[] }> {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(img)], { type: "image/png" }), `${id}.png`);
  const ex = await fetch(`${baseUrl}/api/extract`, { method: "POST", body: form });
  const exBody = (await ex.json()) as { doc?: ExtractedDoc; trace?: TraceEntry[]; error?: string };
  if (!ex.ok || !exBody.doc) throw new Error(`extract ${ex.status}: ${exBody.error}`);
  // Not sending sampleId: a smoke test must exercise the live path, never the cache.
  const res = await fetch(`${baseUrl}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: exBody.doc, context: ctx }),
  });
  if (!res.ok) throw new Error(`audit ${res.status}: ${await res.text()}`);
  let result: AuditResult | null = null;
  for await (const e of readNdjson(res)) {
    if (e.type === "tool") console.log(`  · ${e.summary}`);
    if (e.type === "notice") console.log(`  ! ${e.message}`);
    if (e.type === "error") throw new Error(e.message);
    if (e.type === "result") result = e.data;
  }
  if (!result) throw new Error("audit stream ended without a result");
  return { result, extractTrace: exBody.trace ?? [] };
}

async function inProcess(img: Buffer, ctx: (typeof SAMPLES)[number]["context"]) {
  const { doc, trace: extractTrace } = await extractDocument(img, "image/png");
  const run = await runAudit({
    doc,
    ctx,
    emit: (e: AuditEvent) => e.type === "tool" && console.log(`  · ${e.summary}`),
  });
  if (!run.liveOk) throw new Error(`live run incomplete: ${run.researchError ?? "letter/pidgin failed"}`);
  return { result: run.result, extractTrace };
}

async function main() {
  if (!baseUrl) requireEnv("NEBIUS_API_KEY", "TAVILY_API_KEY");
  let failures = 0;
  for (const s of SAMPLES) {
    console.log(`\n▶ ${s.id} ${baseUrl ? `via ${baseUrl}` : "(in-process)"}`);
    try {
      const img = readFileSync(`public${s.image}`);
      const { result, extractTrace } = baseUrl ? await viaHttp(s.id, img, s.context) : await inProcess(img, s.context);
      const trace = [...extractTrace, ...result.trace];
      if (result.cached) throw new Error("got a cached result — live path not exercised");
      console.log(`  verdict:  ${result.verdict}`);
      console.log(`  total:    ₦${result.overcharge.totalNaira.toLocaleString()}`);
      for (const l of result.overcharge.breakdown) console.log(`            ${l.label}: ₦${l.naira} = ${l.formula}`);
      console.log(`  findings: ${result.agent.findings.length} (${result.agent.findings.filter((f) => f.sourceUrl).length} sourced)`);
      console.log(`  sources:  ${result.sources.length} valid · queries: ${result.tavilyQueries.length}`);
      console.log("\n  step      model                                    latency   in/out        cost");
      for (const t of trace) {
        console.log(
          `  ${t.step.padEnd(9)} ${t.model.padEnd(40)} ${formatMs(t.latencyMs).padStart(7)}   ${`${t.promptTokens ?? "-"}/${t.completionTokens ?? "-"}`.padEnd(12)}  ${formatUsd(t.estCostUsd)}${t.ok ? "" : `  ✗ ${t.error}`}`,
        );
      }
      const latency = trace.reduce((a, t) => a + t.latencyMs, 0);
      const cost = trace.reduce((a, t) => a + (t.estCostUsd ?? 0), 0);
      console.log(`\n  model time ${formatMs(latency)} · audit wall time ${formatMs(result.totals.latencyMs)} · est. cost ${formatUsd(cost)}`);
      if (trace.some((t) => !t.ok)) console.log("  (some calls failed and were retried / fell back — see ✗ above)");
      if (result.sources.length === 0) throw new Error("no valid sources — Tavily research did not produce citations");
    } catch (e) {
      failures++;
      console.error(`  ✗ FAILED: ${(e as Error).message}`);
    }
  }
  if (failures) {
    console.error(`\n${failures} sample(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ smoke passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
