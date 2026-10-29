// In-memory limits. Per serverless instance — good enough to stop runaway cost on a demo.
import { limits } from "./config";

const HOUR = 60 * 60 * 1000;
const windows = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Sliding one-hour window. Records the hit when allowed. */
export function checkRateLimit(
  key: string,
  maxPerHour: number = limits.ratePerHour,
  now: number = Date.now(),
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number } {
  const hits = (windows.get(key) ?? []).filter((t) => now - t < HOUR);
  if (hits.length >= maxPerHour) {
    windows.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((hits[0]! + HOUR - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) {
    for (const [k, v] of windows) if (!v.some((t) => now - t < HOUR)) windows.delete(k);
  }
  return { ok: true, remaining: maxPerHour - hits.length };
}

let day = "";
let liveAuditsToday = 0;

/** Process-level daily cap on live audits. Records one when allowed. */
export function takeDailyAudit(now: Date = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    liveAuditsToday = 0;
  }
  if (liveAuditsToday >= limits.dailyLiveAuditCap) return false;
  liveAuditsToday++;
  return true;
}

export function _resetLimits(): void {
  windows.clear();
  day = "";
  liveAuditsToday = 0;
}
