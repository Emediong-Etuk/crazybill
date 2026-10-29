// Tavily search + extract tools for the research agent, plus the source registry
// that makes sure every cited URL was actually returned by Tavily in this run.
import { tavily, type TavilyClient } from "@tavily/core";
import { tavilyKey } from "./config";
import type { AgentOutput, Source } from "./schemas";

// ---------- source registry (anti-hallucination) ----------

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    return `${host}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export class SourceRegistry {
  private byKey = new Map<string, { url: string; title: string }>();

  add(url: string, title: string | null | undefined): void {
    if (!/^https?:\/\//i.test(url)) return;
    const key = normalizeUrl(url);
    const existing = this.byKey.get(key);
    if (!existing || (!existing.title && title)) this.byKey.set(key, { url, title: title?.trim() || existing?.title || "" });
  }

  has(url: string | null | undefined): boolean {
    return !!url && this.byKey.has(normalizeUrl(url));
  }

  get(url: string): { url: string; title: string } | undefined {
    return this.byKey.get(normalizeUrl(url));
  }

  get size(): number {
    return this.byKey.size;
  }
}

/**
 * Every sourceUrl in the agent output must exist in the registry. Unregistered URLs are set to
 * null and that item's confidence is downgraded to "low". Returns the cleaned output + count stripped.
 */
export function validateSources(out: AgentOutput, reg: SourceRegistry): { output: AgentOutput; stripped: number } {
  let stripped = 0;
  const keep = (url: string | null): string | null => {
    if (!url) return null;
    if (reg.has(url)) return reg.get(url)!.url;
    stripped++;
    return null;
  };
  const keepAll = (urls: string[]) =>
    urls.flatMap((u) => {
      const k = keep(u);
      return k ? [k] : [];
    });

  const output: AgentOutput = {
    ...out,
    tariffLookups: out.tariffLookups.map((t) => {
      const url = keep(t.sourceUrl);
      return { ...t, sourceUrl: url, sourceTitle: url ? t.sourceTitle || reg.get(url)?.title || "" : t.sourceTitle, confidence: url ? t.confidence : "low" };
    }),
    serviceLevels: out.serviceLevels.map((s) => ({ ...s, sourceUrl: keep(s.sourceUrl) })),
    bandAssessment: out.bandAssessment ? { ...out.bandAssessment, sourceUrls: keepAll(out.bandAssessment.sourceUrls) } : null,
    estimatedBillingAssessment: out.estimatedBillingAssessment
      ? { ...out.estimatedBillingAssessment, sourceUrls: keepAll(out.estimatedBillingAssessment.sourceUrls) }
      : null,
    findings: out.findings.map((f) => {
      const url = keep(f.sourceUrl);
      return { ...f, sourceUrl: url, confidence: url ? f.confidence : "low" };
    }),
    escalationPath: out.escalationPath.map((e) => ({ ...e, sourceUrl: keep(e.sourceUrl) })),
  };
  return { output, stripped };
}

/** Sources actually cited in the (validated) output, with what each was used for. */
export function citedSources(out: AgentOutput, reg: SourceRegistry): Source[] {
  const map = new Map<string, Source>();
  const add = (url: string | null, usedFor: string) => {
    if (!url || !reg.has(url)) return;
    const key = normalizeUrl(url);
    const entry = reg.get(url)!;
    const existing = map.get(key);
    if (existing) {
      if (!existing.usedFor.includes(usedFor)) existing.usedFor = `${existing.usedFor}; ${usedFor}`;
    } else {
      map.set(key, { url: entry.url, title: entry.title || entry.url, usedFor });
    }
  };
  for (const t of out.tariffLookups) add(t.sourceUrl, `Band ${t.band} tariff`);
  for (const s of out.serviceLevels) add(s.sourceUrl, `Band ${s.band} supply hours`);
  for (const u of out.bandAssessment?.sourceUrls ?? []) add(u, "Band vs supply hours");
  for (const u of out.estimatedBillingAssessment?.sourceUrls ?? []) add(u, "Estimated billing rule");
  for (const f of out.findings) add(f.sourceUrl, f.title);
  for (const e of out.escalationPath) add(e.sourceUrl, "Complaint path");
  return [...map.values()];
}

// ---------- tools ----------

let _client: TavilyClient | null = null;
function client(): TavilyClient {
  const apiKey = tavilyKey();
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");
  if (!_client) _client = tavily({ apiKey });
  return _client;
}

export type SearchArgs = { query: string; includeDomains?: string[]; maxResults?: number };
export type SearchHit = { title: string; url: string; content: string };

export async function tavilySearch(args: SearchArgs, reg: SourceRegistry): Promise<SearchHit[]> {
  const maxResults = Math.min(8, Math.max(1, Math.round(args.maxResults ?? 5)));
  const includeDomains = args.includeDomains?.filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)).slice(0, 10);
  const res = await client().search(args.query.slice(0, 380), {
    searchDepth: "advanced",
    maxResults,
    ...(includeDomains?.length ? { includeDomains } : {}),
    timeout: 30,
  });
  return res.results.map((r) => {
    reg.add(r.url, r.title);
    return { title: r.title, url: r.url, content: (r.content ?? "").slice(0, 600) };
  });
}

const KEYWORDS = ["band", "tariff", "kwh", "₦", "naira", "nerc", "estimated", "compensation", "order", "minimum", "hours", "complaint", "forum", "vat"];

/** Keeps the paragraphs most relevant to tariffs/bands (in original order) up to maxChars. */
export function prioritiseText(text: string, extraTerms: string[] = [], maxChars = 6000): string {
  if (text.length <= maxChars) return text;
  const terms = [...KEYWORDS, ...extraTerms.map((t) => t.toLowerCase()).filter(Boolean)];
  const paras = text
    .split(/\n\s*\n|\n(?=[#*-]|\d+\.)/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const scored = paras.map((p, i) => {
    const low = p.toLowerCase();
    const score = terms.reduce((s, t) => s + (low.includes(t) ? 1 : 0), 0) + (/\d/.test(p) ? 0.5 : 0);
    return { p: p.slice(0, 1500), i, score };
  });
  const picked = new Set<number>();
  let used = 0;
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (s.score <= 0) break;
    if (used + s.p.length + 2 > maxChars) continue;
    picked.add(s.i);
    used += s.p.length + 2;
  }
  if (picked.size === 0) return text.slice(0, maxChars);
  return scored.filter((s) => picked.has(s.i)).map((s) => s.p).join("\n\n");
}

export type ExtractHit = { url: string; title: string; content: string };

export async function tavilyExtract(urls: string[], reg: SourceRegistry, extraTerms: string[] = []): Promise<{ results: ExtractHit[]; failed: string[] }> {
  const list = [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))].slice(0, 3);
  if (!list.length) return { results: [], failed: [] };
  const res = await client().extract(list, { extractDepth: "advanced", format: "text", timeout: 40 });
  const results = res.results.map((r) => {
    const title = r.title ?? reg.get(r.url)?.title ?? "";
    reg.add(r.url, title);
    return { url: r.url, title, content: prioritiseText(r.rawContent ?? "", extraTerms) };
  });
  return { results, failed: res.failedResults.map((f) => f.url) };
}

export function tavilyConfigured(): boolean {
  return !!tavilyKey();
}

/** Minimal search used by /api/health. */
export async function tavilyPing(): Promise<boolean> {
  const r = await client().search("NERC Nigeria", { maxResults: 1, searchDepth: "basic", timeout: 15 });
  return Array.isArray(r.results);
}
