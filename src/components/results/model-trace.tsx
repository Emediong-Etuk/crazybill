"use client";

import { ChevronDown, Cpu } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMs, formatUsd } from "@/lib/format";
import type { TraceEntry } from "@/lib/schemas";

const shortModel = (m: string) => m.replace(/^nvidia\//i, "");

export function ModelTrace({ trace, totals }: { trace: TraceEntry[]; totals: { latencyMs: number; estCostUsd: number } }) {
  const tokensIn = trace.reduce((s, t) => s + (t.promptTokens ?? 0), 0);
  const tokensOut = trace.reduce((s, t) => s + (t.completionTokens ?? 0), 0);
  return (
    <Collapsible className="rounded-xl border-2 border-ink bg-ink text-paper">
      <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-4 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-volt">
        <span className="flex items-center gap-2 font-heading font-extrabold">
          <Cpu className="size-5 text-volt" aria-hidden /> Model trace
          <span className="font-mono text-xs font-normal text-paper/60">
            {trace.length} calls · {formatMs(totals.latencyMs)} · {formatUsd(totals.estCostUsd)}
          </span>
        </span>
        <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-mono text-xs">
            <caption className="caption-bottom pt-3 text-left text-paper/70">
              All inference on Nebius Token Factory · NVIDIA Nemotron models
            </caption>
            <thead>
              <tr className="border-b border-paper/20 text-left text-paper/60">
                <th className="py-2 pr-2 font-normal">step</th>
                <th className="py-2 pr-2 font-normal">model</th>
                <th className="py-2 pr-2 text-right font-normal">latency</th>
                <th className="py-2 pr-2 text-right font-normal">tokens in/out</th>
                <th className="py-2 text-right font-normal">est. cost</th>
              </tr>
            </thead>
            <tbody>
              {trace.map((t, i) => (
                <tr key={i} className="border-b border-paper/10 align-top">
                  <td className="py-2 pr-2">
                    <span className={t.ok ? "" : "text-signal"}>{t.step}</span>
                    {t.toolCalls?.length ? (
                      <ul className="mt-1 text-paper/60">
                        {t.toolCalls.map((c, k) => (
                          <li key={k}>↳ {c.name}</li>
                        ))}
                      </ul>
                    ) : null}
                    {t.note && <div className="mt-1 text-paper/50">{t.note}</div>}
                    {t.error && <div className="mt-1 text-signal">{t.error}</div>}
                  </td>
                  <td className="py-2 pr-2 break-all">{shortModel(t.model)}</td>
                  <td className="py-2 pr-2 text-right tabular">{formatMs(t.latencyMs)}</td>
                  <td className="py-2 pr-2 text-right tabular">
                    {t.promptTokens ?? "—"}/{t.completionTokens ?? "—"}
                  </td>
                  <td className="py-2 text-right tabular">{formatUsd(t.estCostUsd)}</td>
                </tr>
              ))}
              <tr className="font-bold text-volt">
                <td className="py-2 pr-2">total</td>
                <td className="py-2 pr-2">{trace.length} calls</td>
                <td className="py-2 pr-2 text-right tabular">{formatMs(totals.latencyMs)}</td>
                <td className="py-2 pr-2 text-right tabular">
                  {tokensIn}/{tokensOut}
                </td>
                <td className="py-2 text-right tabular">{formatUsd(totals.estCostUsd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
