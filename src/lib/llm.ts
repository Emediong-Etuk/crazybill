// Server-only wrapper around Nebius Token Factory (OpenAI-compatible) for NVIDIA Nemotron models.
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ZodType } from "zod";
import { capabilitiesFor, type JsonMode } from "./capabilities";
import { estimateCostUsd, nebius } from "./config";
import { jsonSchemaOf, type TraceEntry } from "./schemas";

if (typeof window !== "undefined") {
  throw new Error("llm.ts is server-only");
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!nebius.apiKey) throw new LlmError("NEBIUS_API_KEY is not set", "config");
  if (!_client) {
    _client = new OpenAI({ baseURL: nebius.baseUrl, apiKey: nebius.apiKey, maxRetries: 0 });
  }
  return _client;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public kind: "config" | "timeout" | "http" | "aborted" | "empty",
    public status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

// JSON mode actually accepted by each model in this process (learned at runtime).
const learnedJsonMode = new Map<string, JsonMode>();
const DOWNGRADE: Record<JsonMode, JsonMode | null> = {
  json_schema: "json_object",
  json_object: "prompt",
  prompt: null,
};

export type CallModelOptions = {
  step: TraceEntry["step"];
  model: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  responseSchema?: ZodType;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** true = reasoning ON, false = OFF, undefined = model default. Applied only if a switch is known. */
  thinking?: boolean;
  signal?: AbortSignal;
  trace: TraceEntry[];
  /** Short note recorded in the trace (e.g. "fallback model"). */
  note?: string;
};

export type CallModelResult = {
  message: ChatCompletionMessage;
  content: string;
  reasoning?: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

/** Removes <think>…</think> blocks (and a dangling prefix ending in </think>). */
export function stripThinking(text: string): { content: string; reasoning?: string } {
  const parts: string[] = [];
  let out = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, r: string) => {
    parts.push(r.trim());
    return "";
  });
  const close = out.toLowerCase().lastIndexOf("</think>");
  if (close !== -1) {
    parts.push(out.slice(0, close).replace(/<think>/i, "").trim());
    out = out.slice(close + "</think>".length);
  }
  // Unterminated <think> (truncated output): drop everything after it.
  const open = out.toLowerCase().indexOf("<think>");
  if (open !== -1) {
    parts.push(out.slice(open + 7).trim());
    out = out.slice(0, open);
  }
  const reasoning = parts.filter(Boolean).join("\n\n");
  return { content: out.trim(), reasoning: reasoning || undefined };
}

function isRetryable(e: unknown): boolean {
  if (e instanceof LlmError) return e.kind === "timeout" || (e.status !== undefined && (e.status === 429 || e.status >= 500));
  const status = (e as { status?: number }).status;
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  const name = (e as { name?: string }).name ?? "";
  return /timeout|connection/i.test(name);
}

function isFormatRejection(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  return status === 400 || status === 422;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function applyThinking(
  body: ChatCompletionCreateParamsNonStreaming,
  model: string,
  thinking: boolean | undefined,
): ChatCompletionCreateParamsNonStreaming {
  if (thinking === undefined) return body;
  const sw = capabilitiesFor(model).thinkingSwitch;
  if (sw === "chat_template_kwargs") {
    return { ...body, chat_template_kwargs: { enable_thinking: thinking } } as ChatCompletionCreateParamsNonStreaming;
  }
  if (sw === "system_flag") {
    const flag = thinking ? "/think" : "/no_think";
    const msgs = [...body.messages];
    const first = msgs[0];
    if (first && first.role === "system" && typeof first.content === "string") {
      msgs[0] = { ...first, content: `${flag}\n${first.content}` };
    } else {
      msgs.unshift({ role: "system", content: flag });
    }
    return { ...body, messages: msgs };
  }
  return body;
}

function withJsonMode(
  body: ChatCompletionCreateParamsNonStreaming,
  mode: JsonMode,
  schema: ZodType,
): ChatCompletionCreateParamsNonStreaming {
  if (mode === "json_schema") {
    const js = jsonSchemaOf(schema);
    delete js.$schema;
    return {
      ...body,
      response_format: { type: "json_schema", json_schema: { name: "output", schema: js, strict: false } },
    };
  }
  if (mode === "json_object") return { ...body, response_format: { type: "json_object" } };
  return body;
}

async function once(
  body: ChatCompletionCreateParamsNonStreaming,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<ChatCompletion> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new LlmError(`timed out after ${timeoutMs}ms`, "timeout")), timeoutMs);
  const onOuter = () => ctrl.abort(new LlmError("aborted", "aborted"));
  outer?.addEventListener("abort", onOuter, { once: true });
  try {
    return await client().chat.completions.create(body, { signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted && ctrl.signal.reason instanceof LlmError) throw ctrl.signal.reason;
    throw e;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuter);
  }
}

function describeError(e: unknown): string {
  const status = (e as { status?: number }).status;
  const msg = e instanceof Error ? e.message : String(e);
  return `${status ? `${status} ` : ""}${msg}`.slice(0, 200);
}

export async function callModel(opts: CallModelOptions): Promise<CallModelResult> {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs ?? 60_000;
  let jsonMode: JsonMode | null = opts.responseSchema
    ? (learnedJsonMode.get(opts.model) ?? capabilitiesFor(opts.model).jsonMode)
    : null;

  const base: ChatCompletionCreateParamsNonStreaming = {
    model: opts.model,
    messages: opts.messages,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" as const } : {}),
  };
  const withThinking = applyThinking(base, opts.model, opts.thinking);

  let attempt = 0;
  let res: ChatCompletion | null = null;
  let lastErr: unknown = null;
  while (true) {
    const body = jsonMode && opts.responseSchema ? withJsonMode(withThinking, jsonMode, opts.responseSchema) : withThinking;
    try {
      res = await once(body, timeoutMs, opts.signal);
      break;
    } catch (e) {
      lastErr = e;
      if (opts.signal?.aborted) break;
      if (jsonMode && isFormatRejection(e) && DOWNGRADE[jsonMode]) {
        jsonMode = DOWNGRADE[jsonMode];
        learnedJsonMode.set(opts.model, jsonMode as JsonMode);
        continue;
      }
      if (attempt === 0 && isRetryable(e)) {
        attempt++;
        await sleep(1500);
        continue;
      }
      break;
    }
  }

  if (!res) {
    opts.trace.push({
      step: opts.step,
      model: opts.model,
      latencyMs: Date.now() - t0,
      ok: false,
      error: describeError(lastErr),
      note: opts.note,
    });
    if (lastErr instanceof LlmError) throw lastErr;
    const status = (lastErr as { status?: number }).status;
    throw new LlmError(describeError(lastErr), "http", status);
  }

  const message = res.choices[0]?.message;
  const raw = message?.content ?? "";
  const { content, reasoning: inlineReasoning } = stripThinking(raw);
  const rc = (message as unknown as { reasoning_content?: unknown } | undefined)?.reasoning_content;
  const reasoning = typeof rc === "string" && rc ? rc : inlineReasoning;
  const promptTokens = res.usage?.prompt_tokens;
  const completionTokens = res.usage?.completion_tokens;
  const toolCalls = (message?.tool_calls ?? []).flatMap((tc) =>
    tc.type === "function" ? [{ name: tc.function.name, summary: tc.function.arguments.slice(0, 160) }] : [],
  );

  opts.trace.push({
    step: opts.step,
    model: opts.model,
    latencyMs: Date.now() - t0,
    promptTokens,
    completionTokens,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    estCostUsd: estimateCostUsd(opts.model, promptTokens, completionTokens),
    ok: true,
    note: [opts.note, jsonMode && jsonMode !== capabilitiesFor(opts.model).jsonMode ? `json:${jsonMode}` : null]
      .filter(Boolean)
      .join(" · ") || undefined,
  });

  if (!message) throw new LlmError("empty response", "empty");
  return { message, content, reasoning, usage: { promptTokens, completionTokens } };
}

/** For prompt-only JSON mode, callers append this to the system prompt. */
export function schemaInstruction(schema: ZodType): string {
  const js = jsonSchemaOf(schema);
  delete js.$schema;
  return `Return ONLY one JSON object matching this JSON Schema (no markdown, no prose):\n${JSON.stringify(js)}`;
}
