import { ArrowRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AuditResult } from "@/lib/schemas";
import { SourceChip } from "./source-chip";

const ORDER = { high: 0, medium: 1, low: 2 } as const;

export function FindingsList({ result }: { result: AuditResult }) {
  const findings = [...result.agent.findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const { escalationPath, remedies, missingInfo } = result.agent;
  return (
    <section aria-labelledby="findings" className="flex flex-col gap-3">
      <h2 id="findings" className="font-heading text-xl font-extrabold">
        What we found
      </h2>
      {findings.length === 0 && <p className="text-sm text-ink-soft">The research step didn&apos;t report any rule-based findings.</p>}
      {findings.map((f) => (
        <article key={f.id + f.title} className="flex flex-col gap-2 rounded-xl border-2 border-ink bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={f.severity}>{f.severity}</Badge>
            {f.confidence === "low" && (
              <Badge variant="low" title="Not backed by a page we could verify">
                unverified
              </Badge>
            )}
          </div>
          <h3 className="font-heading text-lg leading-tight font-extrabold">{f.title}</h3>
          <p className="text-[15px] leading-relaxed">{f.explanation}</p>
          {f.rule && (
            <p className="rounded-md bg-paper p-2 text-sm text-ink-soft">
              <span className="font-semibold text-ink">Rule: </span>
              {f.rule}
            </p>
          )}
          {f.sourceUrl && (
            <div>
              <SourceChip url={f.sourceUrl} />
            </div>
          )}
        </article>
      ))}

      {(remedies.length > 0 || escalationPath.length > 0) && (
        <div className="rounded-xl border-2 border-ink bg-volt/30 p-4">
          <h3 className="mb-2 font-heading text-lg font-extrabold">What you can do</h3>
          {remedies.length > 0 && (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-[15px]">
              {remedies.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {escalationPath.length > 0 && (
            <ol className="flex flex-col gap-2">
              {escalationPath.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-white font-mono text-xs font-bold">{i + 1}</span>
                  <div className="min-w-0 text-[15px]">
                    <span className="font-semibold">{e.step}</span>
                    {e.body && <span className="text-ink-soft"> — {e.body}</span>}
                    {e.timeline && <span className="ml-1 font-mono text-xs">({e.timeline})</span>}
                    {e.sourceUrl && (
                      <span className="ml-2 inline-block align-middle">
                        <SourceChip url={e.sourceUrl} />
                      </span>
                    )}
                  </div>
                  {i < escalationPath.length - 1 && <ArrowRight className="sr-only" aria-hidden />}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {missingInfo.length > 0 && (
        <div className="flex gap-2 rounded-lg border-2 border-dashed border-ink/30 p-3 text-sm text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold text-ink">Couldn&apos;t confirm</p>
            <ul className="list-disc pl-4">
              {missingInfo.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
