"use client";

import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { personalise } from "@/lib/share";
import type { AuditResult } from "@/lib/schemas";
import { FindingsList } from "./findings-list";
import { LetterPanel } from "./letter-panel";
import { MathChecksTable } from "./math-checks-table";
import { ModelTrace } from "./model-trace";
import { OverchargeBreakdown } from "./overcharge-breakdown";
import { PidginCard } from "./pidgin-card";
import { SourcesList } from "./sources-list";
import { VerdictBanner } from "./verdict-banner";

export function ResultsView({
  result,
  notice,
  personal,
  onRestart,
}: {
  result: AuditResult;
  notice: string | null;
  personal: { name: string | null; address: string | null };
  onRestart: () => void;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const letter = personalise(result.letter, personal);
  return (
    <div className="flex flex-col gap-6">
      {result.cached && (
        <p className="flex items-start gap-2 rounded-lg border-2 border-amber bg-amber/10 p-3 text-sm font-semibold" role="status">
          <History className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notice ??
            `Showing a saved run from ${new Date(result.cached.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — live service is busy.`}
        </p>
      )}
      {!result.cached && notice && (
        <p className="rounded-lg border-2 border-amber bg-amber/10 p-3 text-sm font-semibold" role="status">
          {notice}
        </p>
      )}
      <div>
        <VerdictBanner result={result} />
        <OverchargeBreakdown result={result} />
      </div>
      <PidginCard pidgin={result.pidgin} appUrl={appUrl} />
      <FindingsList result={result} />
      <MathChecksTable checks={result.checks} />
      <Separator />
      <LetterPanel initial={letter} pidgin={result.pidgin} appUrl={appUrl} personalised={letter !== result.letter} />
      <Separator />
      <SourcesList result={result} />
      <ModelTrace trace={result.trace} totals={result.totals} />
      <Button variant="outline" size="lg" onClick={onRestart}>
        <RotateCcw /> Start over — check another bill
      </Button>
    </div>
  );
}
