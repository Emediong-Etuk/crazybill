import { describe, expect, it } from "vitest";
import { safeCalc } from "../src/lib/agent";
import { citedSources, normalizeUrl, prioritiseText, SourceRegistry, validateSources } from "../src/lib/tavily";
import { agent } from "./helpers";

const reg = () => {
  const r = new SourceRegistry();
  r.add("https://nerc.gov.ng/tariff-order-2026/", "NERC Tariff Order");
  r.add("https://www.phed.com.ng/tariffs?utm_source=x", "PHED tariffs");
  return r;
};

describe("source registry", () => {
  it("normalises www, trailing slash, hash and utm params", () => {
    expect(normalizeUrl("https://www.NERC.gov.ng/a/#top")).toBe(normalizeUrl("https://nerc.gov.ng/a?utm_medium=x"));
  });

  it("strips unregistered URLs and downgrades confidence", () => {
    const out = agent({
      tariffLookups: [
        { disco: "PHED", band: "A", ratePerKWh: 209.5, effectiveFrom: null, sourceUrl: "https://nerc.gov.ng/tariff-order-2026", sourceTitle: "", evidence: "e", confidence: "high" },
        { disco: "PHED", band: "B", ratePerKWh: 63, effectiveFrom: null, sourceUrl: "https://made-up.example.com/b", sourceTitle: "fake", evidence: "e", confidence: "high" },
      ],
      findings: [
        { id: "1", title: "Real", explanation: "x", rule: "r", sourceUrl: "https://phed.com.ng/tariffs", severity: "high", confidence: "high" },
        { id: "2", title: "Hallucinated", explanation: "x", rule: "r", sourceUrl: "https://nerc.gov.ng/does-not-exist", severity: "high", confidence: "high" },
      ],
      serviceLevels: [{ band: "A", minHoursPerDay: 20, sourceUrl: "https://fake.ng/x" }],
      bandAssessment: {
        billedBand: "A",
        minHoursBilledBand: 20,
        reportedAvgHours: 9,
        daysAtThisLevel: 21,
        bandSupportedByHours: "D",
        downgradeRuleApplies: true,
        reasoning: "",
        sourceUrls: ["https://nerc.gov.ng/tariff-order-2026", "https://fake.ng/y"],
      },
      escalationPath: [{ step: "CCU", body: "DisCo", timeline: null, sourceUrl: "https://fake.ng/z" }],
    });
    const { output, stripped } = validateSources(out, reg());
    expect(stripped).toBe(5);
    expect(output.tariffLookups[0]!.sourceUrl).toBe("https://nerc.gov.ng/tariff-order-2026/");
    expect(output.tariffLookups[0]!.sourceTitle).toBe("NERC Tariff Order");
    expect(output.tariffLookups[0]!.confidence).toBe("high");
    expect(output.tariffLookups[1]!.sourceUrl).toBeNull();
    expect(output.tariffLookups[1]!.confidence).toBe("low");
    expect(output.findings[0]!.confidence).toBe("high");
    expect(output.findings[1]!.sourceUrl).toBeNull();
    expect(output.findings[1]!.confidence).toBe("low");
    expect(output.serviceLevels[0]!.sourceUrl).toBeNull();
    expect(output.bandAssessment!.sourceUrls).toHaveLength(1);
    expect(output.escalationPath[0]!.sourceUrl).toBeNull();
  });

  it("only lists sources that were registered and cited", () => {
    const out = agent({
      findings: [
        { id: "1", title: "Real", explanation: "x", rule: "r", sourceUrl: "https://phed.com.ng/tariffs", severity: "high", confidence: "high" },
      ],
    });
    const r = reg();
    const { output } = validateSources(out, r);
    const s = citedSources(output, r);
    expect(s).toHaveLength(1);
    expect(s[0]!.title).toBe("PHED tariffs");
    expect(s[0]!.usedFor).toBe("Real");
  });
});

describe("prioritiseText", () => {
  it("keeps tariff paragraphs within the limit", () => {
    const filler = Array.from({ length: 200 }, (_, i) => `Unrelated paragraph number ${i} about football and weather.`).join("\n\n");
    const text = `${filler}\n\nThe Band A tariff is ₦209.50 per kWh under the NERC order.\n\n${filler}`;
    const out = prioritiseText(text, [], 2000);
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out).toContain("₦209.50 per kWh");
  });
});

describe("calc tool", () => {
  it("evaluates arithmetic", () => expect(safeCalc("(209.5 - 63.4) * 450")).toBe("65745"));
  it("rejects anything else", () => {
    expect(safeCalc("import('fs')")).toMatch(/^error/);
    expect(safeCalc("createUnit('x')")).toMatch(/^error/);
  });
});
