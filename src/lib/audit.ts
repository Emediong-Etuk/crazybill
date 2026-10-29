// Full audit pipeline: checks → research agent → overcharge/verdict → letter + Pidgin.
import { runAgent } from "./agent";
import { runChecks } from "./checks";
import { maskAccount } from "./format";
import { writeLetter, writePidgin, type LetterInput } from "./letter";
import { computeOvercharge } from "./overcharge";
import type { AuditEvent, AuditResult, ExtractedDoc, TraceEntry, UserContext } from "./schemas";
import { decideVerdict, summarize } from "./verdict";

export type AuditRun = { result: AuditResult; liveOk: boolean; researchError?: string };

const nullEmit = () => {};

export async function runAudit(opts: {
  doc: ExtractedDoc;
  ctx: UserContext;
  emit?: (e: AuditEvent) => void;
  signal?: AbortSignal;
  now?: Date;
}): Promise<AuditRun> {
  const emit = opts.emit ?? nullEmit;
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const trace: TraceEntry[] = [];
  // Personal details never go further than this point.
  const doc: ExtractedDoc = { ...opts.doc, customerName: null, address: null, accountOrMeterNo: maskAccount(opts.doc.accountOrMeterNo) };
  const ctx = opts.ctx;

  emit({ type: "step", id: "checks", status: "start", label: "Checking the maths" });
  const checks = runChecks(doc, ctx);
  emit({ type: "step", id: "checks", status: "done", label: `Checked the maths — ${checks.filter((c) => c.status === "fail").length} problem(s)` });

  emit({ type: "step", id: "research", status: "start", label: "Researching NERC tariffs and rules" });
  const agent = await runAgent({
    doc,
    ctx,
    checks,
    trace,
    signal: opts.signal,
    now,
    onTool: (e) => emit({ type: "tool", name: e.name, summary: e.summary }),
  });
  emit({
    type: "step",
    id: "research",
    status: agent.ok ? "done" : "error",
    label: agent.ok ? `Researched ${agent.sources.length} source(s)` : "Research step failed — showing maths checks only",
  });

  emit({ type: "step", id: "compute", status: "start", label: "Calculating the overcharge" });
  const overcharge = computeOvercharge(doc, checks, agent.output, ctx);
  const verdict = decideVerdict(doc, ctx, checks, agent.output, overcharge);
  const summary = summarize(verdict, overcharge, doc);
  emit({ type: "step", id: "compute", status: "done", label: "Calculated the overcharge" });

  emit({ type: "step", id: "letter", status: "start", label: "Writing your complaint letter" });
  const input: LetterInput = { doc, ctx, maskedAccount: doc.accountOrMeterNo, verdict, summary, overcharge, agent: agent.output, today: now };
  const [letter, pidgin] = await Promise.all([writeLetter(input, trace), writePidgin(input, trace)]);
  emit({ type: "step", id: "letter", status: "done", label: "Wrote your complaint letter" });

  const writingOk = trace.filter((t) => t.step === "letter" || t.step === "pidgin").every((t) => t.ok);
  const result: AuditResult = {
    verdict,
    summary,
    overcharge,
    checks,
    agent: agent.output,
    letter,
    pidgin,
    sources: agent.sources,
    tavilyQueries: agent.queries,
    trace,
    totals: {
      latencyMs: Date.now() - t0,
      estCostUsd: Math.round(trace.reduce((s, t) => s + (t.estCostUsd ?? 0), 0) * 1e6) / 1e6,
    },
    meta: { disco: ctx.disco, maskedAccount: doc.accountOrMeterNo, docType: doc.docType, generatedAt: now.toISOString() },
  };
  return { result, liveOk: agent.ok && writingOk, researchError: agent.error };
}
