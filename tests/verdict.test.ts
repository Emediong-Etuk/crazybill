import { describe, expect, it } from "vitest";
import { runChecks } from "../src/lib/checks";
import { computeOvercharge } from "../src/lib/overcharge";
import { decideVerdict, summarize } from "../src/lib/verdict";
import type { AgentOutput, ExtractedDoc, UserContext } from "../src/lib/schemas";
import { agent, ctx, doc, postpaid } from "./helpers";

function verdictOf(d: ExtractedDoc, a: AgentOutput, c: UserContext = ctx()) {
  const checks = runChecks(d, c);
  const o = computeOvercharge(d, checks, a, c);
  return decideVerdict(d, c, checks, a, o);
}

const finding = (over: Partial<AgentOutput["findings"][number]> = {}) => ({
  id: "f1",
  title: "Band A rate charged",
  explanation: "x",
  rule: "NERC order",
  sourceUrl: "https://nerc.gov.ng/x",
  severity: "high" as const,
  confidence: "high" as const,
  ...over,
});
const tariff = (rate: number) => [
  { disco: "PHED", band: "A" as const, ratePerKWh: rate, effectiveFrom: null, sourceUrl: "https://nerc.gov.ng/t", sourceTitle: "t", evidence: "e" },
];

describe("verdict", () => {
  it("needs_info when there is no kWh", () => {
    expect(verdictOf(doc({ docType: "postpaid_bill" }), agent())).toBe("needs_info");
  });

  it("likely_overcharged with sourced high-confidence finding and big total", () => {
    expect(verdictOf(postpaid(), agent({ tariffLookups: tariff(150), findings: [finding()] }))).toBe("likely_overcharged");
  });

  it("likely_overcharged from code-proven arithmetic alone", () => {
    expect(verdictOf(postpaid({ energyCharge: 92000, vat: 6900, totalDue: 98900 }), agent({ tariffLookups: tariff(200) }))).toBe(
      "likely_overcharged",
    );
  });

  it("possible_issues when total is big but finding is unsourced", () => {
    const a = agent({ tariffLookups: tariff(150), findings: [finding({ sourceUrl: null, confidence: "low" })] });
    expect(verdictOf(postpaid(), a)).toBe("possible_issues");
  });

  it("possible_issues for an estimated read with nothing else", () => {
    expect(verdictOf(postpaid({ readType: "estimated" }), agent({ tariffLookups: tariff(200) }))).toBe("possible_issues");
  });

  it("possible_issues for a medium finding", () => {
    const a = agent({ tariffLookups: tariff(200), findings: [finding({ severity: "medium", confidence: "medium" })] });
    expect(verdictOf(postpaid(), a)).toBe("possible_issues");
  });

  it("looks_fine when everything checks out", () => {
    expect(verdictOf(postpaid(), agent({ tariffLookups: tariff(200), findings: [finding({ severity: "low" })] }))).toBe("looks_fine");
  });

  it("summary mentions the amount", () => {
    expect(summarize("likely_overcharged", { totalNaira: 18400, breakdown: [] }, postpaid())).toBe(
      "You may have been overcharged about ₦18,400 on this bill.",
    );
  });
});
