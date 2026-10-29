import { describe, expect, it } from "vitest";
import { runChecks } from "../src/lib/checks";
import { computeOvercharge } from "../src/lib/overcharge";
import type { AgentOutput } from "../src/lib/schemas";
import { agent, ctx, postpaid, prepaid } from "./helpers";

const lookups = (a: number | null, b: number | null): AgentOutput["tariffLookups"] => [
  ...(a ? [{ disco: "PHED", band: "A" as const, ratePerKWh: a, effectiveFrom: "2026-01", sourceUrl: "https://nerc.gov.ng/a", sourceTitle: "A", evidence: "x" }] : []),
  ...(b ? [{ disco: "PHED", band: "B" as const, ratePerKWh: b, effectiveFrom: "2026-01", sourceUrl: "https://nerc.gov.ng/b", sourceTitle: "B", evidence: "x" }] : []),
];

const downgrade = (over: Partial<NonNullable<AgentOutput["bandAssessment"]>> = {}): AgentOutput["bandAssessment"] => ({
  billedBand: "A",
  minHoursBilledBand: 20,
  reportedAvgHours: 14,
  daysAtThisLevel: 10,
  bandSupportedByHours: "B",
  downgradeRuleApplies: true,
  reasoning: "",
  sourceUrls: [],
  ...over,
});

const run = (d: ReturnType<typeof postpaid>, a: AgentOutput, c = ctx()) => computeOvercharge(d, runChecks(d, c), a, c);

describe("computeOvercharge", () => {
  it("arithmetic only: energy charge +₦2,000", () => {
    const r = run(postpaid({ energyCharge: 92000, vat: 6900, totalDue: 98900 }), agent());
    expect(r.totalNaira).toBe(2000);
    expect(r.breakdown[0]!.kind).toBe("arithmetic");
    expect(r.breakdown[0]!.formula).toMatch(/₦92,000/);
  });

  it("band mismatch: billed A, supply supports B", () => {
    const c = ctx({ avgHoursPerDay: 14 });
    const r = run(postpaid(), agent({ tariffLookups: lookups(200, 60), bandAssessment: downgrade() }), c);
    // 450 × (200 − 60) × 1.075
    expect(r.totalNaira).toBe(Math.round(450 * 140 * 1.075));
    expect(r.breakdown[0]!.formula).toBe("450 kWh × (₦200.00 − ₦60.00) × 1.075");
  });

  it("rate above approved", () => {
    const r = run(postpaid(), agent({ tariffLookups: lookups(180, null) }));
    expect(r.totalNaira).toBe(Math.round(450 * 20 * 1.075));
  });

  it("ignores a rate within 1% of approved", () => {
    expect(run(postpaid(), agent({ tariffLookups: lookups(199, null) })).totalNaira).toBe(0);
  });

  it("B and C overlap: keeps only the larger", () => {
    const c = ctx({ avgHoursPerDay: 14 });
    const r = run(postpaid(), agent({ tariffLookups: lookups(180, 60), bandAssessment: downgrade() }), c);
    expect(r.breakdown).toHaveLength(1);
    expect(r.totalNaira).toBe(Math.round(450 * 140 * 1.075));
  });

  it("A is added on top of B/C", () => {
    const c = ctx({ avgHoursPerDay: 14 });
    const d = postpaid({ energyCharge: 92000, vat: 6900, totalDue: 98900 });
    const r = run(d, agent({ tariffLookups: lookups(200, 60), bandAssessment: downgrade() }), c);
    expect(r.breakdown).toHaveLength(2);
    expect(r.totalNaira).toBe(2000 + Math.round(450 * 140 * (1 + 6900 / 92000)));
  });

  it("does not apply band mismatch when hours meet the billed band's sourced minimum", () => {
    const a = agent({
      tariffLookups: lookups(200, 60),
      bandAssessment: downgrade(),
      serviceLevels: [{ band: "A", minHoursPerDay: 20, sourceUrl: "https://nerc.gov.ng/a" }],
    });
    expect(run(postpaid(), a, ctx({ avgHoursPerDay: 21 })).totalNaira).toBe(0);
  });

  it("ignores unsourced tariffs", () => {
    const l = lookups(180, null).map((t) => ({ ...t, sourceUrl: null }));
    expect(run(postpaid(), agent({ tariffLookups: l })).totalNaira).toBe(0);
  });

  it("prepaid units shortfall", () => {
    const d = prepaid({ tokenUnitsKWh: 88.37 });
    const r = computeOvercharge(d, runChecks(d, ctx()), agent(), ctx());
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0]!.formula).toMatch(/kWh short × ₦200\.00 × 1\.075/);
    expect(r.totalNaira).toBe(Math.round((93.02 - 88.37) * 200 * 1.075));
  });

  it("is never negative (undercharged bill)", () => {
    const r = run(postpaid({ energyCharge: 80000, totalDue: 50000 }), agent({ tariffLookups: lookups(250, null) }));
    expect(r.totalNaira).toBe(0);
    expect(r.breakdown.every((l) => l.naira > 0)).toBe(true);
  });

  it("every line has a formula string", () => {
    const c = ctx({ avgHoursPerDay: 14 });
    const r = run(postpaid({ energyCharge: 92000, totalDue: 99000 }), agent({ tariffLookups: lookups(200, 60), bandAssessment: downgrade() }), c);
    expect(r.breakdown.length).toBeGreaterThan(0);
    for (const l of r.breakdown) expect(l.formula.length).toBeGreaterThan(5);
  });
});
