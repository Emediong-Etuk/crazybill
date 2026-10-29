import { AlertOctagon, CheckCircle2, HelpCircle, TriangleAlert } from "lucide-react";
import { formatNaira } from "@/lib/format";
import type { AuditResult } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const LABEL: Record<AuditResult["verdict"], string> = {
  likely_overcharged: "Likely overcharged",
  possible_issues: "Possible issues",
  looks_fine: "Looks fine",
  needs_info: "Need more info",
};

export function VerdictBanner({ result }: { result: AuditResult }) {
  const v = result.verdict;
  const Icon = v === "likely_overcharged" ? AlertOctagon : v === "possible_issues" ? TriangleAlert : v === "looks_fine" ? CheckCircle2 : HelpCircle;
  const showAmount = result.overcharge.totalNaira > 0;
  return (
    <section
      aria-labelledby="verdict"
      className={cn(
        "rounded-t-xl border-2 border-b-0 border-ink bg-white p-5 pb-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          id="verdict"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border-2 border-ink px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider",
            v === "likely_overcharged" && "bg-volt",
            v === "possible_issues" && "bg-amber/20",
            v === "looks_fine" && "bg-pass/15",
            v === "needs_info" && "bg-paper-deep",
          )}
        >
          <Icon className="size-4" aria-hidden /> {LABEL[v]}
        </p>
        <span className="font-mono text-[11px] uppercase text-ink-soft">Audit receipt</span>
      </div>
      {showAmount && (
        <div className="mt-4">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Estimated overcharge</p>
          <p className={cn("font-mono text-6xl font-bold tracking-tight tabular sm:text-7xl", v === "likely_overcharged" ? "text-signal" : "text-ink")}>
            {formatNaira(result.overcharge.totalNaira)}
          </p>
        </div>
      )}
      <p className={cn("text-lg font-semibold leading-snug", showAmount ? "mt-2" : "mt-4")}>{result.summary}</p>
    </section>
  );
}
