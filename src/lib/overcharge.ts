// ₦ overcharge computation (spec §11). All money maths happens here, never in the LLM.
import { impliedVatRate, prepaidNetEnergy } from "./checks";
import { vatRateHint } from "./config";
import { formatNaira, formatNumber } from "./format";
import type { AgentOutput, Band, CheckResult, ExtractedDoc, Overcharge, OverchargeLine, TariffLookup, UserContext } from "./schemas";

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const fmtRate = (n: number) => formatNaira(n, true);

export function vatFactor(doc: ExtractedDoc): { factor: number; source: "bill" | "hint" } {
  const implied = impliedVatRate(doc);
  if (implied !== null) return { factor: 1 + implied, source: "bill" };
  return { factor: 1 + vatRateHint(), source: "hint" };
}

/** kWh and the ₦/kWh actually charged. */
export function chargedBasis(doc: ExtractedDoc): { kwh: number | null; rate: number | null; rateImplied: boolean } {
  if (doc.docType === "prepaid_token") {
    const kwh = isNum(doc.tokenUnitsKWh) && doc.tokenUnitsKWh > 0 ? doc.tokenUnitsKWh : null;
    if (isNum(doc.ratePerKWh) && doc.ratePerKWh > 0) return { kwh, rate: doc.ratePerKWh, rateImplied: false };
    const net = prepaidNetEnergy(doc);
    if (kwh && net && net.net > 0) return { kwh, rate: net.net / kwh, rateImplied: true };
    return { kwh, rate: null, rateImplied: false };
  }
  const kwh = isNum(doc.kWhBilled) && doc.kWhBilled > 0 ? doc.kWhBilled : null;
  if (isNum(doc.ratePerKWh) && doc.ratePerKWh > 0) return { kwh, rate: doc.ratePerKWh, rateImplied: false };
  if (kwh && isNum(doc.energyCharge) && doc.energyCharge > 0) return { kwh, rate: doc.energyCharge / kwh, rateImplied: true };
  return { kwh, rate: null, rateImplied: false };
}

const CONF_RANK = { high: 3, medium: 2, low: 1 } as const;

/** Best sourced tariff for a band (only lookups that survived source validation). */
export function tariffFor(agent: AgentOutput, band: Band | null): TariffLookup | null {
  if (!band) return null;
  const cands = agent.tariffLookups.filter((t) => t.band === band && t.sourceUrl && t.ratePerKWh > 0 && t.confidence !== "low");
  if (!cands.length) return null;
  return [...cands].sort((a, b) => {
    const c = CONF_RANK[b.confidence ?? "medium"] - CONF_RANK[a.confidence ?? "medium"];
    if (c) return c;
    return (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? "");
  })[0]!;
}

export function billedBand(doc: ExtractedDoc, agent: AgentOutput): Band | null {
  if (doc.tariffBand) return doc.tariffBand;
  const b = agent.bandAssessment?.billedBand?.trim().toUpperCase().match(/^(?:BAND\s*)?([A-E])\b/);
  return b ? (b[1] as Band) : null;
}

/** Code-side guard: reported hours really are below the billed band's sourced minimum. */
function hoursBelowBilledBand(agent: AgentOutput, band: Band | null, ctx: UserContext): boolean {
  if (!band) return false;
  const level = agent.serviceLevels.find((s) => s.band === band && s.sourceUrl);
  const min = level?.minHoursPerDay ?? agent.bandAssessment?.minHoursBilledBand ?? null;
  return isNum(min) ? ctx.avgHoursPerDay < min : true;
}

function line(label: string, naira: number, formula: string, kind: OverchargeLine["kind"] = "arithmetic"): OverchargeLine | null {
  const n = Math.max(0, Math.round(naira));
  return n > 0 ? { label, naira: n, formula, kind } : null;
}

export function computeOvercharge(
  doc: ExtractedDoc,
  checks: CheckResult[],
  agent: AgentOutput,
  ctx: UserContext,
): Overcharge {
  const lines: OverchargeLine[] = [];
  const byId = (id: CheckResult["id"]) => checks.find((c) => c.id === id);
  const { factor, source } = vatFactor(doc);
  const vf = factor.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const vatNote = source === "hint" ? " (VAT rate assumed)" : "";
  const { kwh, rate } = chargedBasis(doc);

  // A. Arithmetic — added independently.
  const reading = byId("reading_diff");
  if (reading?.status === "fail" && isNum(reading.diff) && reading.diff > 0 && rate) {
    const l = line(
      "kWh billed above your meter readings",
      reading.diff * rate * factor,
      `${formatNumber(reading.diff)} extra kWh × ${fmtRate(rate)} × ${vf}${vatNote}`,
    );
    if (l) lines.push(l);
  }
  const energy = byId("energy_charge");
  if (energy?.status === "fail" && isNum(energy.diff) && energy.diff > 0) {
    const l = line(
      "Energy charge doesn't match kWh × rate",
      energy.diff,
      `${formatNaira(energy.actual, true)} charged − ${formatNaira(energy.expected, true)} (kWh × rate)`,
    );
    if (l) lines.push(l);
  }
  const total = byId("bill_total");
  if (total?.status === "fail" && isNum(total.diff) && total.diff > 0) {
    const l = line(
      "Total due is more than the bill's own parts",
      total.diff,
      `${formatNaira(total.actual, true)} total − ${formatNaira(total.expected, true)} (sum of parts)`,
    );
    if (l) lines.push(l);
  }
  const units = byId("token_units");
  if (units?.status === "fail" && isNum(units.diff) && units.diff < 0 && rate) {
    const short = -units.diff;
    const l = line(
      "Fewer units than you paid for",
      short * rate * factor,
      `${formatNumber(short)} kWh short × ${fmtRate(rate)} × ${vf}${vatNote}`,
    );
    if (l) lines.push(l);
  }

  // B vs C — overlapping, keep only the larger.
  const band = billedBand(doc, agent);
  let bLine: OverchargeLine | null = null;
  let cLine: OverchargeLine | null = null;
  if (kwh && rate) {
    const ba = agent.bandAssessment;
    const supported = ba?.bandSupportedByHours ?? null;
    if (ba?.downgradeRuleApplies && supported && supported !== band && hoursBelowBilledBand(agent, band, ctx)) {
      const t = tariffFor(agent, supported);
      if (t && rate > t.ratePerKWh) {
        bLine = line(
          `Billed at Band ${band ?? "?"} rate, but your supply fits Band ${supported}`,
          kwh * (rate - t.ratePerKWh) * factor,
          `${formatNumber(kwh)} kWh × (${fmtRate(rate)} − ${fmtRate(t.ratePerKWh)}) × ${vf}${vatNote}`,
          "tariff",
        );
      }
    }
    const approved = tariffFor(agent, band);
    if (approved && rate > approved.ratePerKWh * 1.01) {
      cLine = line(
        `Rate above the approved Band ${band} tariff`,
        kwh * (rate - approved.ratePerKWh) * factor,
        `${formatNumber(kwh)} kWh × (${fmtRate(rate)} − ${fmtRate(approved.ratePerKWh)}) × ${vf}${vatNote}`,
        "tariff",
      );
    }
  }
  const tariffLine = bLine && cLine ? (bLine.naira >= cLine.naira ? bLine : cLine) : (bLine ?? cLine);
  if (tariffLine) lines.push(tariffLine);

  return { totalNaira: lines.reduce((s, l) => s + l.naira, 0), breakdown: lines };
}
