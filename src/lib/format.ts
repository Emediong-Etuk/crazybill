// Formatting helpers (safe for client and server).

const naira = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const naira2 = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

export function formatNaira(n: number | null | undefined, decimals = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = (decimals ? naira2 : naira).format(Math.abs(n));
  return `${n < 0 ? "−" : ""}₦${s}`;
}

export function formatNumber(n: number | null | undefined, unit?: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${plain.format(n)}${unit ? ` ${unit}` : ""}`;
}

export function formatPercent(r: number | null | undefined): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

/** Keep only the last 4 alphanumerics: "0123456789" → "••••6789". */
export function maskAccount(v: string | null | undefined): string | null {
  if (!v) return null;
  const clean = v.replace(/[^0-9a-z]/gi, "");
  if (clean.length === 0) return null;
  return `••••${clean.slice(-4)}`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}
