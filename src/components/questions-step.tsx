"use client";

import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DISCOS } from "@/lib/discos";
import type { UserContext } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const METER_OPTIONS: { value: UserContext["meterSituation"]; label: string; hint: string }[] = [
  { value: "prepaid_meter", label: "Prepaid meter", hint: "I buy tokens" },
  { value: "postpaid_meter", label: "Postpaid meter", hint: "Meter is read for a monthly bill" },
  { value: "no_meter", label: "No meter", hint: "I get estimated bills" },
  { value: "unsure", label: "Not sure", hint: "" },
];

export type ExtractStatus = "reading" | "done" | "error";

export function QuestionsStep({
  previewUrl,
  context,
  onChange,
  extractStatus,
  extractError,
  onContinue,
  onBack,
}: {
  previewUrl: string | null;
  context: UserContext;
  onChange: (c: UserContext) => void;
  extractStatus: ExtractStatus;
  extractError: string | null;
  onContinue: () => void;
  onBack: () => void;
}) {
  const set = <K extends keyof UserContext>(k: K, v: UserContext[K]) => onChange({ ...context, [k]: v });
  const valid = context.disco !== "" && context.daysAtThisLevel >= 1 && context.daysAtThisLevel <= 90;

  return (
    <section aria-labelledby="q-title" className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-xl border-2 border-ink bg-white p-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Your bill" className="size-16 rounded-md border border-ink/20 object-cover" />
        ) : (
          <div className="size-16 rounded-md bg-ink/10" />
        )}
        <div className="flex-1 text-sm" aria-live="polite">
          {extractStatus === "reading" && (
            <p className="flex items-center gap-2 font-semibold">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading your photo with Nemotron…
            </p>
          )}
          {extractStatus === "done" && (
            <p className="flex items-center gap-2 font-semibold text-pass">
              <CheckCircle2 className="size-4" aria-hidden /> Photo read. Answer these, then check the fields.
            </p>
          )}
          {extractStatus === "error" && (
            <p className="flex items-start gap-2 font-semibold text-signal">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{extractError ?? "We couldn't read the photo."} You can type the numbers in on the next screen.</span>
            </p>
          )}
          <p className="mt-0.5 text-ink-soft">While we read it: a few quick questions.</p>
        </div>
      </div>

      <h2 id="q-title" className="sr-only">
        About your supply
      </h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="disco">Your DisCo</Label>
        <Select id="disco" value={context.disco} onChange={(e) => set("disco", e.target.value)}>
          <option value="" disabled>
            Choose your electricity company
          </option>
          {DISCOS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name} ({d.code})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hours">On average, how many hours of light per day lately?</Label>
        <div className="flex items-end gap-3">
          <output htmlFor="hours" className="font-mono text-5xl font-bold tabular leading-none" aria-live="polite">
            {context.avgHoursPerDay}
          </output>
          <span className="pb-1 text-ink-soft">hours / day</span>
        </div>
        <Slider
          id="hours"
          aria-label="Average hours of light per day"
          min={0}
          max={24}
          step={1}
          value={[context.avgHoursPerDay]}
          onValueChange={(v) => set("avgHoursPerDay", v[0] ?? 0)}
        />
        <div className="flex justify-between font-mono text-xs text-ink-soft">
          <span>0</span>
          <span>Band A needs ~20+</span>
          <span>24</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="days">For about how many days?</Label>
        <div className="flex items-center gap-2">
          <Input
            id="days"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            className="w-28 font-mono text-lg"
            value={Number.isFinite(context.daysAtThisLevel) ? context.daysAtThisLevel : ""}
            onChange={(e) => set("daysAtThisLevel", Math.round(Number(e.target.value)))}
            aria-invalid={!valid}
          />
          <span className="text-ink-soft">days (1–90)</span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Your meter situation</legend>
        <div className="grid grid-cols-2 gap-2">
          {METER_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col justify-center rounded-lg border-2 px-3 py-2 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-volt",
                context.meterSituation === o.value ? "border-ink bg-volt" : "border-ink/25 bg-white",
              )}
            >
              <input
                type="radio"
                name="meter"
                value={o.value}
                checked={context.meterSituation === o.value}
                onChange={() => set("meterSituation", o.value)}
                className="sr-only"
              />
              <span className="font-semibold">{o.label}</span>
              {o.hint && <span className="text-xs text-ink-soft">{o.hint}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Anything else? <span className="font-normal text-ink-soft">(optional)</span>
        </Label>
        <Input
          id="notes"
          maxLength={300}
          placeholder="e.g. bill doubled this month, no meter for 2 years"
          value={context.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || undefined)}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Start over
        </Button>
        <Button size="lg" onClick={onContinue} disabled={!valid}>
          {extractStatus === "reading" ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden /> Still reading… continue
            </>
          ) : (
            "Continue — check the fields"
          )}
        </Button>
      </div>
    </section>
  );
}
