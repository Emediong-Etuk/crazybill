// Probes Nebius Token Factory model capabilities (spec §3).
// Usage: npm run probe            → print summary table
//        npm run probe -- --write → also rewrite src/lib/capabilities.ts
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { chromium } from "playwright";
import { requireEnv } from "./env";
import { models, nebius } from "../src/lib/config";
import type { JsonMode, ModelCapabilities, ThinkingSwitch } from "../src/lib/capabilities";

type Row = { probe: string; model: string; result: string; ms: number };
const rows: Row[] = [];

const client = () =>
  new OpenAI({ baseURL: nebius.baseUrl, apiKey: nebius.apiKey, timeout: 120_000, maxRetries: 0 });

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - t0 };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return { error: `${err.status ?? ""} ${err.message ?? String(e)}`.trim().slice(0, 160), ms: Date.now() - t0 };
  }
}

async function renderTestImage(): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 200 } });
  await page.setContent(
    `<body style="margin:0;background:#fff;font:28px monospace;padding:40px">Rate: 209.50 NGN/kWh<br>Units: 95.4 kWh</body>`,
  );
  const png = await page.screenshot({ type: "png" });
  await browser.close();
  return `data:image/png;base64,${png.toString("base64")}`;
}

type Msg = { content?: string | null; reasoning_content?: string; tool_calls?: unknown[] };

async function probeVision(img: string, model: string) {
  const r = await timed(() =>
    client().chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: img } },
            { type: "text", text: "What rate and units are written in the image? Reply briefly." },
          ],
        },
      ],
    }),
  );
  const text = r.value?.choices[0]?.message.content ?? "";
  const ok = !r.error && /209[.,]5/.test(text);
  rows.push({ probe: "vision", model, result: r.error ?? (ok ? "ok" : `read wrong: ${text.slice(0, 60)}`), ms: r.ms });
  return ok;
}

const schema = {
  type: "object",
  properties: { city: { type: "string" }, population: { type: "number" } },
  required: ["city", "population"],
  additionalProperties: false,
};

async function probeJson(model: string): Promise<JsonMode> {
  const messages = [
    { role: "system" as const, content: "Reply with JSON only: {\"city\": string, \"population\": number}." },
    { role: "user" as const, content: "Lagos, approx 15 million people." },
  ];
  const valid = (s: string | null | undefined) => {
    try {
      const j = JSON.parse((s ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim());
      return typeof j.city === "string" && typeof j.population === "number";
    } catch {
      return false;
    }
  };
  const a = await timed(() =>
    client().chat.completions.create({
      model,
      messages,
      max_tokens: 400,
      response_format: { type: "json_schema", json_schema: { name: "city", schema, strict: true } },
    }),
  );
  if (!a.error && valid(a.value?.choices[0]?.message.content)) {
    rows.push({ probe: "json", model, result: "json_schema", ms: a.ms });
    return "json_schema";
  }
  const b = await timed(() =>
    client().chat.completions.create({ model, messages, max_tokens: 400, response_format: { type: "json_object" } }),
  );
  if (!b.error && valid(b.value?.choices[0]?.message.content)) {
    rows.push({ probe: "json", model, result: `json_object (schema: ${a.error ?? "invalid output"})`, ms: b.ms });
    return "json_object";
  }
  rows.push({ probe: "json", model, result: `prompt-only (${b.error ?? "invalid output"})`, ms: b.ms });
  return "prompt";
}

async function probeTools(model: string): Promise<boolean> {
  const r = await timed(() =>
    client().chat.completions.create({
      model,
      max_tokens: 800,
      messages: [{ role: "user", content: "What's the weather in Port Harcourt? Use the tool." }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get current weather for a city",
            parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
          },
        },
      ],
    }),
  );
  const calls = (r.value?.choices[0]?.message as Msg | undefined)?.tool_calls ?? [];
  const ok = !r.error && calls.length > 0;
  rows.push({ probe: "tools", model, result: r.error ?? (ok ? `ok (${calls.length} call)` : "no tool_calls"), ms: r.ms });
  return ok;
}

async function probeThinking(model: string): Promise<ThinkingSwitch> {
  const ask = (extra: Record<string, unknown>, system?: string) =>
    timed(() =>
      client().chat.completions.create({
        model,
        max_tokens: 600,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user" as const, content: "Is 391 prime? Answer yes or no." },
        ],
        ...extra,
      } as OpenAI.ChatCompletionCreateParamsNonStreaming),
    );
  const shape = (m: Msg | undefined) => {
    const think = /<think>/.test(m?.content ?? "");
    const rc = typeof m?.reasoning_content === "string" && m.reasoning_content.length > 0;
    return { think, rc, any: think || rc };
  };
  const base = await ask({});
  const s0 = shape(base.value?.choices[0]?.message as Msg);
  rows.push({
    probe: "reasoning shape",
    model,
    result: base.error ?? `<think> in content: ${s0.think}, reasoning_content: ${s0.rc}`,
    ms: base.ms,
  });
  if (!s0.any) return "none";
  const off = await ask({ chat_template_kwargs: { enable_thinking: false } });
  if (!off.error && !shape(off.value?.choices[0]?.message as Msg).any) {
    rows.push({ probe: "thinking switch", model, result: "chat_template_kwargs works", ms: off.ms });
    return "chat_template_kwargs";
  }
  const flag = await ask({}, "/no_think");
  if (!flag.error && !shape(flag.value?.choices[0]?.message as Msg).any) {
    rows.push({ probe: "thinking switch", model, result: "/no_think system flag works", ms: flag.ms });
    return "system_flag";
  }
  rows.push({ probe: "thinking switch", model, result: "no switch found", ms: flag.ms });
  return "none";
}

async function main() {
  requireEnv("NEBIUS_API_KEY");
  const img = await renderTestImage();

  const visionOk = await probeVision(img, models.vision);
  const fallbackOk = await probeVision(img, models.visionFallback);

  const caps: Record<string, ModelCapabilities> = {};
  const targets = [
    { id: models.fast, vision: false },
    { id: models.vision, vision: visionOk },
    { id: models.visionFallback, vision: fallbackOk },
    { id: models.reason, vision: false },
  ];
  for (const t of targets) {
    if (caps[t.id]) continue;
    const t0 = Date.now();
    const jsonMode = await probeJson(t.id);
    const supportsTools = await probeTools(t.id);
    const thinkingSwitch = await probeThinking(t.id);
    caps[t.id] = {
      jsonMode,
      supportsTools,
      supportsVision: t.vision,
      thinkingSwitch,
      verified: true,
      latencyMs: Math.round((Date.now() - t0) / 4),
    };
  }

  console.log("\n" + "probe".padEnd(18) + "model".padEnd(44) + "ms".padStart(7) + "  result");
  console.log("-".repeat(110));
  for (const r of rows) console.log(r.probe.padEnd(18) + r.model.padEnd(44) + String(r.ms).padStart(7) + "  " + r.result);

  const reasonTools = caps[models.reason]?.supportsTools;
  console.log(`\nVision: ${visionOk ? "primary ok" : fallbackOk ? "FALLBACK only" : "FAILED"} · Ultra tools: ${reasonTools ? "ok" : "FAILED"}`);

  if (process.argv.includes("--write")) {
    const file = "src/lib/capabilities.ts";
    const src = await import("node:fs").then((fs) => fs.readFileSync(file, "utf8"));
    const out = src
      .replace(/export const PROBED_AT[^\n]*\n/, `export const PROBED_AT: string | null = ${JSON.stringify(new Date().toISOString())};\n`)
      .replace(
        /export const CAPABILITIES[\s\S]*?\n};\n|export const CAPABILITIES[^\n]*\n/,
        `export const CAPABILITIES: Record<string, ModelCapabilities> = ${JSON.stringify(caps, null, 2)};\n`,
      )
      .replace(/\/\/ STATUS:[\s\S]*?\n\/\/ is rejected[^\n]*\n/, "// STATUS: written by scripts/probe.ts — see PROBED_AT.\n");
    writeFileSync(file, out);
    console.log(`Wrote ${file}`);
  }
  if (!(visionOk || fallbackOk) || !reasonTools) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
