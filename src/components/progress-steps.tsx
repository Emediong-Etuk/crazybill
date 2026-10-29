"use client";

import { Calculator, Check, FileText, Globe, Loader2, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StepId } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type StepState = { id: StepId; label: string; status: "pending" | "start" | "done" | "error" };
export type ToolEvent = { name: string; summary: string };

export const INITIAL_STEPS: StepState[] = [
  { id: "checks", label: "Checking the maths", status: "pending" },
  { id: "research", label: "Researching NERC tariffs", status: "pending" },
  { id: "compute", label: "Calculating", status: "pending" },
  { id: "letter", label: "Writing your letter", status: "pending" },
];

const TOOL_ICON: Record<string, typeof Search> = { tavily_search: Search, tavily_extract: Globe, calc: Calculator };

export function ProgressSteps({ steps, tools, notice }: { steps: StepState[]; tools: ToolEvent[]; notice: string | null }) {
  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-5">
      <div>
        <h2 id="progress-title" className="font-heading text-2xl font-extrabold">
          Auditing your bill…
        </h2>
        <p className="text-sm text-ink-soft">This takes about a minute — the agent is reading live NERC and DisCo pages.</p>
      </div>
      {notice && (
        <p className="rounded-lg border-2 border-amber bg-amber/10 p-3 text-sm font-semibold" role="status">
          {notice}
        </p>
      )}
      <ol className="flex flex-col rounded-xl border-2 border-ink bg-white p-4" aria-live="polite" aria-relevant="additions text">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  s.status === "done" && "border-ink bg-volt",
                  s.status === "start" && "border-ink bg-white",
                  s.status === "pending" && "border-ink/25 bg-white text-ink/30",
                  s.status === "error" && "border-signal bg-signal text-white",
                )}
                aria-hidden
              >
                {s.status === "done" ? (
                  <Check className="size-4" />
                ) : s.status === "start" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : s.status === "error" ? (
                  <X className="size-4" />
                ) : s.id === "letter" ? (
                  <FileText className="size-4" />
                ) : (
                  <span className="font-mono text-xs">{i + 1}</span>
                )}
              </span>
              {i < steps.length - 1 && <span className="my-1 w-0.5 flex-1 bg-ink/15" aria-hidden />}
            </div>
            <div className={cn("min-w-0 flex-1 pt-1", i < steps.length - 1 && "pb-4")}>
              <p className={cn("font-semibold", s.status === "pending" && "text-ink/40")}>
                {s.label}
                <span className="sr-only">
                  {" "}
                  — {s.status === "start" ? "in progress" : s.status === "pending" ? "waiting" : s.status}
                </span>
              </p>
              {s.id === "research" && tools.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {tools.map((t, k) => {
                    const Icon = TOOL_ICON[t.name] ?? Search;
                    return (
                      <li key={k} className="flex items-start gap-2 rounded-md bg-paper px-2 py-1.5 font-mono text-xs break-words">
                        <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0">{t.summary}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </section>
  );
}
