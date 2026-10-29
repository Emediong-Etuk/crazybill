// Saved sample runs (public/samples/<id>.result.json), replayed when the live service is busy.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditEvent, AuditResult, ExtractedDoc, UserContext } from "./schemas";
import type { SampleId } from "./samples";

export type SampleCache = {
  savedAt: string;
  doc: ExtractedDoc;
  context: UserContext;
  events: AuditEvent[];
  result: AuditResult;
};

export async function loadSampleCache(id: SampleId, origin?: string): Promise<SampleCache | null> {
  const file = `${id}.result.json`;
  try {
    return JSON.parse(await readFile(join(process.cwd(), "public", "samples", file), "utf8")) as SampleCache;
  } catch {
    /* not on the function's filesystem (e.g. Vercel) — fetch the static file */
  }
  if (!origin) return null;
  try {
    const res = await fetch(new URL(`/samples/${file}`, origin), { cache: "no-store" });
    return res.ok ? ((await res.json()) as SampleCache) : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function replaySample(cache: SampleCache, emit: (e: AuditEvent) => void, reason: string): Promise<void> {
  const date = new Date(cache.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  emit({ type: "notice", message: `Showing a saved run from ${date} — ${reason}`, replay: true });
  for (const e of cache.events) {
    if (e.type !== "step" && e.type !== "tool") continue;
    emit(e);
    await sleep(300);
  }
  emit({ type: "result", data: { ...cache.result, cached: { savedAt: cache.savedAt } } });
}
