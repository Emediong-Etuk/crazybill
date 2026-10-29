"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FIELD_GROUPS, FIELD_META, fieldLabel } from "@/lib/fields";
import { BANDS, NUMERIC_DOC_FIELDS, toNumberOrNull, type ExtractedDoc } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Draft = Record<string, string>;

function toDraft(doc: ExtractedDoc): Draft {
  const d: Draft = {};
  for (const [k, v] of Object.entries(doc)) {
    if (typeof v === "number" || typeof v === "string") d[k] = String(v);
  }
  return d;
}

function fromDraft(base: ExtractedDoc, draft: Draft): ExtractedDoc {
  const out: Record<string, unknown> = { ...base };
  for (const group of FIELD_GROUPS) {
    for (const f of group.fields) {
      const raw = draft[f] ?? "";
      out[f] = (NUMERIC_DOC_FIELDS as readonly string[]).includes(f) ? toNumberOrNull(raw) : raw.trim() || null;
    }
  }
  out.docType = draft.docType || base.docType;
  out.tariffBand = draft.tariffBand || null;
  out.readType = draft.readType || null;
  return out as ExtractedDoc;
}

export function ReviewStep({
  doc,
  loading,
  onSubmit,
  onBack,
}: {
  doc: ExtractedDoc | null;
  loading: boolean;
  onSubmit: (doc: ExtractedDoc) => void;
  onBack: () => void;
}) {
  if (loading || !doc) {
    return (
      <section className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Still reading your photo…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border-2 border-ink/20 bg-white p-4">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
        ))}
      </section>
    );
  }
  return <ReviewForm key={JSON.stringify(doc)} doc={doc} onSubmit={onSubmit} onBack={onBack} />;
}

function ReviewForm({ doc, onSubmit, onBack }: { doc: ExtractedDoc; onSubmit: (d: ExtractedDoc) => void; onBack: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(doc));
  const docType = (draft.docType as ExtractedDoc["docType"]) || doc.docType;
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const groups = useMemo(() => {
    const seen = new Set<string>();
    return FIELD_GROUPS.filter((g) => g.for.includes(docType)).map((g) => ({
      ...g,
      fields: g.fields.filter((f) => (seen.has(f) ? false : (seen.add(f), true))),
    }));
  }, [docType]);

  const lowFields = Object.entries(doc.fieldConfidence).filter(([, c]) => c === "low").map(([k]) => k);
  const unreadable = doc.unreadableFields;
  const flagged = new Set([...lowFields, ...unreadable]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(fromDraft(doc, draft));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-labelledby="review-title">
      <div>
        <h2 id="review-title" className="font-heading text-2xl font-extrabold">
          Check what we read
        </h2>
        <p className="text-sm text-ink-soft">Fix anything that&apos;s wrong. Fields outlined in amber need a second look.</p>
      </div>

      {(unreadable.length > 0 || doc.docType === "unknown") && (
        <div className="flex gap-2 rounded-lg border-2 border-amber bg-amber/10 p-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#8a5300]" aria-hidden />
          <div>
            {doc.docType === "unknown" && <p className="font-semibold">We couldn&apos;t tell what kind of document this is — pick one below.</p>}
            {unreadable.length > 0 && (
              <p>
                <span className="font-semibold">Couldn&apos;t read:</span> {unreadable.map(fieldLabel).join(", ")}. Type them in if you can see them.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border-2 border-ink bg-white p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="docType">Document</Label>
          <Select id="docType" value={docType} onChange={(e) => set("docType", e.target.value)}>
            <option value="postpaid_bill">Postpaid bill</option>
            <option value="prepaid_token">Prepaid token receipt</option>
            <option value="unknown">Not sure</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tariffBand">Tariff band</Label>
          <Select
            id="tariffBand"
            value={draft.tariffBand ?? ""}
            onChange={(e) => set("tariffBand", e.target.value)}
            className={cn(flagged.has("tariffBand") && "border-amber ring-2 ring-amber/40")}
          >
            <option value="">Not shown</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                Band {b}
              </option>
            ))}
          </Select>
        </div>
        {docType !== "prepaid_token" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="readType">Read type</Label>
            <Select id="readType" value={draft.readType ?? ""} onChange={(e) => set("readType", e.target.value)}>
              <option value="">Not shown</option>
              <option value="actual">Actual</option>
              <option value="estimated">Estimated</option>
            </Select>
          </div>
        )}
      </div>

      {groups.map((g) => (
        <fieldset key={g.id} className="rounded-xl border-2 border-ink bg-white p-4">
          <legend className="-ml-1 bg-white px-1 font-mono text-xs font-bold uppercase tracking-widest">{g.title}</legend>
          <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4">
            {g.fields.map((f) => {
              const meta = FIELD_META[f];
              const numeric = (NUMERIC_DOC_FIELDS as readonly string[]).includes(f);
              const isFlagged = flagged.has(f);
              const wide = !numeric;
              const id = `f-${f}`;
              return (
                <div key={f} className={cn("flex flex-col gap-1.5", wide && "col-span-2")}>
                  <Label htmlFor={id}>{meta?.label ?? f}</Label>
                  <div className="relative">
                    {meta?.kind === "money" && (
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-ink-soft">₦</span>
                    )}
                    <Input
                      id={id}
                      inputMode={numeric ? "decimal" : "text"}
                      autoComplete="off"
                      value={draft[f] ?? ""}
                      placeholder={unreadable.includes(f) ? "type it" : "—"}
                      onChange={(e) => set(f, e.target.value)}
                      aria-describedby={meta?.hint ? `${id}-hint` : undefined}
                      className={cn(
                        numeric && "font-mono tabular",
                        meta?.kind === "money" && "pl-7",
                        isFlagged && "border-amber ring-2 ring-amber/40",
                      )}
                    />
                  </div>
                  {isFlagged && (
                    <span className="w-fit rounded bg-amber px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink">
                      {unreadable.includes(f) ? "couldn't read — check this" : "check this"}
                    </span>
                  )}
                  {meta?.hint && (
                    <span id={`${id}-hint`} className="text-xs text-ink-soft">
                      {meta.hint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" size="lg">
          Looks right — audit my bill
        </Button>
      </div>
    </form>
  );
}
