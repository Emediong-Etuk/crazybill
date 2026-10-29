import { formatNaira } from "@/lib/format";
import type { AuditResult } from "@/lib/schemas";

export function OverchargeBreakdown({ result }: { result: AuditResult }) {
  const lines = result.overcharge.breakdown;
  return (
    <section aria-labelledby="breakdown" className="rounded-b-xl border-2 border-t-0 border-ink bg-white px-5 pt-4 pb-5">
      <div className="perforation mb-4" aria-hidden />
      <h3 id="breakdown" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
        How we got the number
      </h3>
      {lines.length === 0 ? (
        <p className="text-sm text-ink-soft">No ₦ overcharge could be calculated from what we found.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((l, i) => (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{l.label}</span>
                <span className="shrink-0 font-mono font-bold tabular text-signal">{formatNaira(l.naira)}</span>
              </div>
              <code className="rounded bg-paper px-2 py-1 font-mono text-xs break-words text-ink-soft">{l.formula}</code>
            </li>
          ))}
          <li className="flex items-baseline justify-between border-t-2 border-ink pt-2">
            <span className="font-heading font-extrabold">Total</span>
            <span className="font-mono text-lg font-bold tabular">{formatNaira(result.overcharge.totalNaira)}</span>
          </li>
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-soft">All ₦ maths is done in code from the bill and sourced tariffs — not by the AI.</p>
    </section>
  );
}
