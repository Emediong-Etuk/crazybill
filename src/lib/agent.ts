// Nemotron 3 Ultra research agent: tool loop over Tavily search/extract + calc (spec §10).
import { evaluate } from "mathjs";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { capabilitiesFor } from "./capabilities";
import { limits, models } from "./config";
import { discoByCode, discoLabel } from "./discos";
import { seedHints } from "./domain-hints";
import { parseJson } from "./json";
import { callModel } from "./llm";
import { redactDoc, scrubText } from "./redact";
import { modelRepair } from "./repair";
import {
  AgentOutputSchema,
  emptyAgentOutput,
  jsonSchemaOf,
  type AgentOutput,
  type CheckResult,
  type ExtractedDoc,
  type Source,
  type TraceEntry,
  type UserContext,
} from "./schemas";
import { citedSources, SourceRegistry, tavilyExtract, tavilySearch, validateSources } from "./tavily";

export const AGENT_SYSTEM_PROMPT = `You are CrazyBill's audit agent. You check Nigerian electricity bills and prepaid token
receipts for overcharging against CURRENT NERC (Nigerian Electricity Regulatory
Commission) rules and approved tariffs.

You receive: (1) extracted document fields (personal details removed), (2) the customer's
reported supply hours and meter situation, (3) arithmetic checks already computed by
code, (4) seed hints that may be outdated.

Your tasks:
1. Find the current approved tariff in ₦/kWh for this DisCo and the customer's billed
   band, AND for the band their reported supply hours actually support. Prefer the
   DisCo's official tariff page or NERC orders; recent reputable news is acceptable.
   Record the effective date.
2. Find the minimum supply hours per band and the downgrade/compensation rules. Decide
   whether the customer's reported hours (avg X h/day for N days) mean they are billed
   in a higher band than the service they actually receive.
3. If postpaid with an estimated read or no meter, find the current NERC rule on
   estimated billing / capping for unmetered customers and whether it applies.
4. Find the complaint and escalation path, including response timelines if published.
5. Produce findings a non-expert Nigerian customer can understand.

Rules:
- Use tools for every number, rate, date and rule. Never rely on memory. Seed hints are
  only starting points.
- Budget: at most {{MAX_TOOLS}} tool calls. Plan: 1–2 targeted searches, extract the single best
  page, one follow-up search if needed, then stop.
- Use calc for any arithmetic. Do NOT compute the final overcharge — code does that from
  your tariffLookups and bandAssessment.
- Every finding and lookup must cite a sourceUrl returned by a tool in this session. If
  you cannot source something, set sourceUrl to null and confidence to "low".
- Plain English, short sentences. Say "you may be entitled to ask for…", never "you will
  get…". No legal advice.
- If key information is missing (band, rate, kWh), list it in missingInfo instead of
  guessing.
- Final answer: ONLY one JSON object matching the schema below. No markdown, no prose.

SCHEMA:
{{AGENT_OUTPUT_JSON_SCHEMA}}

{{SEED_HINTS}}`;

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "tavily_search",
      description:
        "Web search (Tavily, advanced depth). Returns up to maxResults results with title, url and a content snippet. Use includeDomains to target nerc.gov.ng or a DisCo website.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Specific search query" },
          includeDomains: { type: "array", items: { type: "string" }, description: "Optional domain allow-list, e.g. [\"nerc.gov.ng\"]" },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Default 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tavily_extract",
      description: "Fetches the readable text of up to 3 URLs (≤6,000 chars each, most relevant paragraphs first).",
      parameters: {
        type: "object",
        properties: { urls: { type: "array", items: { type: "string" }, maxItems: 3 } },
        required: ["urls"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc",
      description: "Evaluates an arithmetic expression, e.g. \"(209.5 - 63.4) * 450\". Numbers and + - * / ^ ( ) % only, plus round/floor/ceil/abs/min/max/sqrt.",
      parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
    },
  },
];

const CALC_ALLOWED = /^(?:[\d\s+\-*/().,%^eE]|round|floor|ceil|abs|min|max|sqrt)*$/;

export function safeCalc(expression: string): string {
  const expr = expression.trim().slice(0, 300);
  if (!expr || !CALC_ALLOWED.test(expr)) return "error: only numbers, + - * / ^ ( ) % and round/floor/ceil/abs/min/max/sqrt are allowed";
  try {
    const v: unknown = evaluate(expr);
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v * 1e6) / 1e6);
    return "error: expression did not produce a number";
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

export type AgentEvent = { name: "tavily_search" | "tavily_extract" | "calc"; summary: string };

export type AgentRun = {
  output: AgentOutput;
  sources: Source[];
  queries: string[];
  ok: boolean;
  error?: string;
  strippedUrls: number;
};

function starterQueries(doc: ExtractedDoc, ctx: UserContext, today: Date): string[] {
  const d = discoByCode(ctx.disco);
  const disco = d && d.code !== "OTHER" ? d.code : (doc.disco ?? "DisCo");
  const month = today.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });
  const q = [
    `${disco} Band ${doc.tariffBand ?? "A"} tariff per kWh ${month}`,
    "NERC minimum hours of supply Band A B C D E",
  ];
  if (doc.docType !== "prepaid_token" && (doc.readType === "estimated" || ctx.meterSituation === "no_meter")) {
    q.push(`NERC estimated billing cap unmetered customers ${disco}`);
  }
  q.push("NERC customer complaint procedure Forum Office");
  return q;
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  if (name === "tavily_search") {
    const dom = Array.isArray(args.includeDomains) && args.includeDomains.length ? ` on ${(args.includeDomains as string[]).join(", ")}` : "";
    return `Searching${dom}: "${String(args.query ?? "").slice(0, 120)}"`;
  }
  if (name === "tavily_extract") {
    const urls = Array.isArray(args.urls) ? (args.urls as string[]) : [];
    const hosts = urls.map((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return u;
      }
    });
    return `Reading ${hosts.join(", ") || "page"}`;
  }
  return `Calculating ${String(args.expression ?? "").slice(0, 80)}`;
}

export async function runAgent(opts: {
  doc: ExtractedDoc;
  ctx: UserContext;
  checks: CheckResult[];
  trace: TraceEntry[];
  onTool?: (e: AgentEvent) => void;
  signal?: AbortSignal;
  now?: Date;
}): Promise<AgentRun> {
  const { doc, ctx, checks, trace, onTool } = opts;
  const today = opts.now ?? new Date();
  const reg = new SourceRegistry();
  const queries: string[] = [];
  const maxTools = limits.agentMaxToolCalls;
  const deadline = Date.now() + limits.agentTimeoutMs;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limits.agentTimeoutMs);
  opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

  const schema = jsonSchemaOf(AgentOutputSchema);
  delete schema.$schema;
  const system = AGENT_SYSTEM_PROMPT.replace("{{MAX_TOOLS}}", String(maxTools))
    .replace("{{AGENT_OUTPUT_JSON_SCHEMA}}", JSON.stringify(schema))
    .replace("{{SEED_HINTS}}", seedHints());

  const disco = discoByCode(ctx.disco);
  const userPayload = {
    today: today.toISOString().slice(0, 10),
    disco: disco ? discoLabel(disco.code) : ctx.disco,
    redactedDoc: redactDoc(doc),
    userContext: {
      disco: ctx.disco,
      avgHoursPerDay: ctx.avgHoursPerDay,
      daysAtThisLevel: ctx.daysAtThisLevel,
      meterSituation: ctx.meterSituation,
      ...(ctx.notes ? { notes: scrubText(ctx.notes) } : {}),
    },
    checks: checks.map(({ id, status, expected, actual, diff, explanation }) => ({ id, status, expected, actual, diff, explanation })),
    suggestedStarterQueries: starterQueries(doc, ctx, today),
  };

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(userPayload) },
  ];

  let toolCalls = 0;
  let finalText: string | null = null;
  const useTools = capabilitiesFor(models.reason).supportsTools;

  try {
    for (let turn = 0; turn < limits.agentMaxTurns && finalText === null; turn++) {
      const remaining = deadline - Date.now();
      const budgetLeft = toolCalls < maxTools && remaining > 35_000 && turn < limits.agentMaxTurns - 1;
      if (!budgetLeft && turn > 0) {
        messages.push({ role: "user", content: "Tool budget used up. Produce the final JSON now with what you have." });
      }
      const res = await callModel({
        step: "research",
        model: models.reason,
        trace,
        messages,
        tools: budgetLeft && useTools ? AGENT_TOOLS : undefined,
        responseSchema: budgetLeft ? undefined : AgentOutputSchema,
        temperature: 0.2,
        thinking: true,
        maxTokens: 6000,
        timeoutMs: Math.max(20_000, Math.min(90_000, remaining - 5_000)),
        signal: ctrl.signal,
      });
      const calls = (res.message.tool_calls ?? []).filter((c) => c.type === "function");
      if (!calls.length || !budgetLeft) {
        finalText = res.content;
        break;
      }
      messages.push({
        role: "assistant",
        content: res.content || null,
        tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.function.name, arguments: c.function.arguments } })),
      });
      for (const call of calls) {
        let result: string;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          /* handled below */
        }
        if (toolCalls >= maxTools) {
          result = "error: tool budget used up — produce the final JSON now";
        } else {
          toolCalls++;
          const name = call.function.name as AgentEvent["name"];
          const summary = summarizeArgs(name, args);
          onTool?.({ name, summary });
          const traceEntry = trace[trace.length - 1];
          try {
            if (name === "tavily_search") {
              const query = String(args.query ?? "").trim();
              if (!query) throw new Error("query is required");
              queries.push(query);
              const hits = await tavilySearch(
                {
                  query,
                  includeDomains: Array.isArray(args.includeDomains) ? (args.includeDomains as string[]) : undefined,
                  maxResults: typeof args.maxResults === "number" ? args.maxResults : undefined,
                },
                reg,
              );
              result = JSON.stringify(hits.length ? hits : { results: [], note: "no results — try a broader query" });
            } else if (name === "tavily_extract") {
              const urls = Array.isArray(args.urls) ? (args.urls as string[]) : [];
              const out = await tavilyExtract(urls, reg, [disco?.code ?? "", doc.disco ?? ""]);
              result = JSON.stringify(out);
            } else if (name === "calc") {
              result = safeCalc(String(args.expression ?? ""));
            } else {
              result = `error: unknown tool ${call.function.name}`;
            }
          } catch (e) {
            result = `error: ${(e as Error).message.slice(0, 200)}`;
          }
          if (traceEntry && traceEntry.toolCalls) {
            const tc = traceEntry.toolCalls.find((t) => t.name === call.function.name && t.summary === call.function.arguments.slice(0, 160));
            if (tc) tc.summary = summary;
          }
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    if (finalText === null) {
      // Turn limit reached while still calling tools: one final call without tools.
      messages.push({ role: "user", content: "Tool budget used up. Produce the final JSON now with what you have." });
      const res = await callModel({
        step: "research",
        model: models.reason,
        trace,
        messages,
        responseSchema: AgentOutputSchema,
        temperature: 0.2,
        thinking: true,
        maxTokens: 6000,
        timeoutMs: Math.max(20_000, deadline - Date.now()),
        signal: ctrl.signal,
      });
      finalText = res.content;
    }

    const parsed = await parseJson(finalText, AgentOutputSchema, modelRepair(AgentOutputSchema, trace));
    const { output, stripped } = validateSources(parsed, reg);
    const last = [...trace].reverse().find((t) => t.step === "research");
    if (last) last.note = [last.note, `${reg.size} sources retrieved · ${stripped} unverified URL${stripped === 1 ? "" : "s"} stripped`].filter(Boolean).join(" · ");
    return { output, sources: citedSources(output, reg), queries, ok: true, strippedUrls: stripped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "research failed";
    const output = emptyAgentOutput();
    output.missingInfo = ["The research step could not finish, so tariffs and rules were not checked."];
    return { output, sources: [], queries, ok: false, error: msg.slice(0, 200), strippedUrls: 0 };
  } finally {
    clearTimeout(timer);
  }
}
