import { CheckCircle2, Info, MinusCircle, XCircle } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { CheckResult } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ICON = { pass: CheckCircle2, fail: XCircle, skipped: MinusCircle, info: Info } as const;
const COLOR = { pass: "text-pass", fail: "text-signal", skipped: "text-ink/35", info: "text-[#8a5300]" } as const;

export function MathChecksTable({ checks }: { checks: CheckResult[] }) {
  return (
    <section aria-labelledby="checks" className="flex flex-col gap-3">
      <h2 id="checks" className="font-heading text-xl font-extrabold">
        Maths checks
      </h2>
      <ul className="divide-y-2 divide-dashed divide-ink/15 rounded-xl border-2 border-ink bg-white">
        {checks.map((c) => {
          const Icon = ICON[c.status];
          return (
            <li key={c.id} className="flex gap-3 p-3">
              <Icon className={cn("mt-0.5 size-5 shrink-0", COLOR[c.status])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-semibold">{c.label}</span>
                  <span className={cn("font-mono text-xs font-bold uppercase", COLOR[c.status])}>{c.status}</span>
                </p>
                <p className="text-sm text-ink-soft">{c.explanation}</p>
                {c.status === "fail" && c.expected !== null && c.actual !== null && (
                  <p className="mt-1 font-mono text-xs tabular">
                    expected {formatNumber(c.expected)} · printed {formatNumber(c.actual)} · diff {formatNumber(c.diff)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
