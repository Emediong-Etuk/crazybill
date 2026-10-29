// Verdict logic (spec §11), computed in code.
import { billedBand, chargedBasis } from "./overcharge";
import { formatNaira } from "./format";
import type { AgentOutput, CheckResult, ExtractedDoc, Overcharge, UserContext, Verdict } from "./schemas";

export function overchargeThreshold(doc: ExtractedDoc): number {
  const base = doc.totalDue ?? doc.amountPaid ?? 0;
  return Math.max(500, 0.02 * Math.abs(base));
}

export function decideVerdict(
  doc: ExtractedDoc,
  ctx: UserContext,
  checks: CheckResult[],
  agent: AgentOutput,
  overcharge: Overcharge,
): Verdict {
  const failed = checks.some((c) => c.status === "fail");
  const { kwh, rate } = chargedBasis(doc);
  const band = billedBand(doc, agent);
  const sourcedTariff = agent.tariffLookups.some((t) => t.sourceUrl);
  const threshold = overchargeThreshold(doc);

  if ((!kwh || !rate || (!band && !sourcedTariff)) && !failed) return "needs_info";

  const strongFinding = agent.findings.some((f) => f.confidence === "high" && f.sourceUrl);
  const arithmetic = overcharge.breakdown
    .filter((l) => l.kind === "arithmetic")
    .reduce((s, l) => s + l.naira, 0);
  if (overcharge.totalNaira >= threshold && (strongFinding || arithmetic >= threshold)) return "likely_overcharged";

  const estimated =
    doc.docType !== "prepaid_token" && (doc.readType === "estimated" || ctx.meterSituation === "no_meter");
  const notableFinding = agent.findings.some((f) => f.severity === "high" || f.severity === "medium");
  if (failed || notableFinding || estimated || overcharge.totalNaira > 0) return "possible_issues";
  return "looks_fine";
}

export function summarize(verdict: Verdict, overcharge: Overcharge, doc: ExtractedDoc): string {
  const what = doc.docType === "prepaid_token" ? "token purchase" : "bill";
  const amt = formatNaira(overcharge.totalNaira);
  switch (verdict) {
    case "likely_overcharged":
      return `You may have been overcharged about ${amt} on this ${what}.`;
    case "possible_issues":
      return overcharge.totalNaira > 0
        ? `We found possible problems worth about ${amt} on this ${what} — worth raising with your DisCo.`
        : `We found possible problems on this ${what} that are worth raising with your DisCo.`;
    case "looks_fine":
      return `This ${what} looks consistent with the rules we could check.`;
    case "needs_info":
      return `We need a few more details (like kWh and rate) to check this ${what} properly.`;
  }
}
