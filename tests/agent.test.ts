import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallModelOptions } from "../src/lib/llm";

// Scripted model: two tool turns, then final JSON citing one real and one invented URL.
const script: ((o: CallModelOptions) => unknown)[] = [];
vi.mock("../src/lib/llm", async (orig) => {
  const actual = await orig<typeof import("../src/lib/llm")>();
  return {
    ...actual,
    callModel: vi.fn(async (o: CallModelOptions) => {
      const step = script.shift();
      if (!step) throw new Error("unexpected model call");
      const message = step(o) as { content: string | null; tool_calls?: unknown[] };
      o.trace.push({ step: o.step, model: o.model, latencyMs: 1, ok: true });
      return { message: { role: "assistant", refusal: null, ...message }, content: message.content ?? "" };
    }),
  };
});
vi.mock("../src/lib/tavily", async (orig) => {
  const actual = await orig<typeof import("../src/lib/tavily")>();
  return {
    ...actual,
    tavilySearch: vi.fn(async (args: { query: string }, reg: InstanceType<typeof actual.SourceRegistry>) => {
      reg.add("https://nerc.gov.ng/order-2026", "NERC Order 2026");
      return [{ title: "NERC Order 2026", url: "https://nerc.gov.ng/order-2026", content: `Band A ₦209.50/kWh (${args.query})` }];
    }),
    tavilyExtract: vi.fn(async () => ({ results: [], failed: [] })),
  };
});

import { runAgent } from "../src/lib/agent";
import { runChecks } from "../src/lib/checks";
import { ctx, postpaid } from "./helpers";

const toolCall = (id: string, name: string, args: unknown) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

beforeEach(() => {
  script.length = 0;
});

describe("runAgent", () => {
  it("runs tools, validates sources and records queries", async () => {
    script.push(
      () => ({ content: null, tool_calls: [toolCall("1", "tavily_search", { query: "PHED Band A tariff" })] }),
      () => ({ content: null, tool_calls: [toolCall("2", "calc", { expression: "209.5 * 2" })] }),
      (o) => {
        expect(o.tools).toBeDefined();
        return {
          content: JSON.stringify({
            tariffLookups: [
              { disco: "PHED", band: "A", ratePerKWh: 209.5, effectiveFrom: "2026-01-01", sourceUrl: "https://nerc.gov.ng/order-2026", sourceTitle: "NERC", evidence: "Band A ₦209.50/kWh" },
            ],
            serviceLevels: [],
            bandAssessment: null,
            estimatedBillingAssessment: null,
            findings: [
              { id: "a", title: "Sourced", explanation: "x", rule: "r", sourceUrl: "https://nerc.gov.ng/order-2026", severity: "high", confidence: "high" },
              { id: "b", title: "Invented", explanation: "x", rule: "r", sourceUrl: "https://nerc.gov.ng/fake", severity: "high", confidence: "high" },
            ],
            remedies: [],
            escalationPath: [],
            missingInfo: [],
          }),
        };
      },
    );
    const events: string[] = [];
    const d = postpaid();
    const run = await runAgent({ doc: d, ctx: ctx(), checks: runChecks(d, ctx()), trace: [], onTool: (e) => events.push(e.summary) });
    expect(run.ok).toBe(true);
    expect(run.queries).toEqual(["PHED Band A tariff"]);
    expect(events[0]).toMatch(/Searching: "PHED Band A tariff"/);
    expect(events[1]).toMatch(/Calculating/);
    expect(run.strippedUrls).toBe(1);
    expect(run.output.findings[1]!.sourceUrl).toBeNull();
    expect(run.output.findings[1]!.confidence).toBe("low");
    expect(run.sources.map((s) => s.url)).toEqual(["https://nerc.gov.ng/order-2026"]);
  });

  it("forces a final answer without tools when the budget is used up", async () => {
    process.env.AGENT_MAX_TOOL_CALLS = "2";
    script.push(
      () => ({
        content: null,
        tool_calls: [
          toolCall("1", "tavily_search", { query: "q1" }),
          toolCall("2", "tavily_search", { query: "q2" }),
          toolCall("3", "tavily_search", { query: "q3" }),
        ],
      }),
      (o) => {
        expect(o.tools).toBeUndefined();
        const last = o.messages[o.messages.length - 1]!;
        expect(last.role).toBe("user");
        expect(String(last.content)).toMatch(/Tool budget used up/);
        return { content: '{"findings": [], "tariffLookups": []}' };
      },
    );
    const d = postpaid();
    const run = await runAgent({ doc: d, ctx: ctx(), checks: [], trace: [] });
    delete process.env.AGENT_MAX_TOOL_CALLS;
    expect(run.ok).toBe(true);
    expect(run.queries).toEqual(["q1", "q2"]);
  });

  it("never sends personal data to the model", async () => {
    let seen = "";
    script.push((o) => {
      seen = JSON.stringify(o.messages);
      return { content: "{}" };
    });
    const d = postpaid({ customerName: "Ada Okafor", address: "12 Aba Road", accountOrMeterNo: "0123456789" });
    await runAgent({ doc: d, ctx: ctx(), checks: [], trace: [] });
    expect(seen).not.toContain("Ada Okafor");
    expect(seen).not.toContain("Aba Road");
    expect(seen).not.toContain("0123456789");
    expect(seen).toContain("6789");
  });

  it("returns a safe empty result when the model fails", async () => {
    script.push(() => {
      throw new Error("boom");
    });
    const run = await runAgent({ doc: postpaid(), ctx: ctx(), checks: [], trace: [] });
    expect(run.ok).toBe(false);
    expect(run.output.missingInfo.length).toBe(1);
  });
});
