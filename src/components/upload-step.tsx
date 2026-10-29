"use client";

import { useRef } from "react";
import { Camera, Check, ImageUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HowItWorks } from "@/components/how-it-works";
import { PrivacyNote } from "@/components/privacy-note";
import { SAMPLES, type SampleId } from "@/lib/samples";

export function UploadStep({
  onFile,
  onSample,
  busy,
}: {
  onFile: (file: File) => void;
  onSample: (id: SampleId) => void;
  busy: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };

  return (
    <section aria-labelledby="hero" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 pt-2">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-ink bg-volt px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider">
          <span className="size-2 rounded-full bg-ink" aria-hidden /> NEPA bill checker
        </p>
        <h1 id="hero" className="font-heading text-[2.4rem] leading-[1.16] font-extrabold tracking-tight sm:text-5xl">
          Snap your light bill.
          <br />
          <span className="bg-volt px-1 box-decoration-clone">Find the overcharge.</span>
          <br />
          Send the complaint.
        </h1>
        <p className="text-base text-ink-soft">
          For Nigerian electricity customers — postpaid bills and prepaid token receipts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" className="h-16 text-lg" onClick={() => cameraRef.current?.click()} disabled={busy}>
          <Camera className="size-6" /> Take photo
        </Button>
        <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => galleryRef.current?.click()} disabled={busy}>
          <ImageUp className="size-6" /> Upload from gallery
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Take a photo of your bill"
          onChange={pick}
          tabIndex={-1}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="sr-only"
          aria-label="Upload a photo of your bill"
          onChange={pick}
          tabIndex={-1}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4" aria-hidden /> No bill handy? Try a sample:
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => onSample(s.id)}
              className="min-h-11 rounded-full border-2 border-dashed border-ink bg-white px-4 text-sm font-semibold hover:border-solid hover:bg-volt focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-volt disabled:opacity-50"
            >
              Try: {s.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="perforation" aria-hidden />

      <div>
        <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">What we check</h2>
        <ul className="flex flex-col gap-2.5">
          {[
            ["Maths errors", "readings, kWh × rate, VAT, totals and token units — recomputed in code"],
            ["Wrong band for the light you actually get", "Band A promises 20+ hours a day"],
            ["Rates above NERC-approved tariffs", "looked up live, with sources"],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink bg-volt">
                <Check className="size-4" aria-hidden />
              </span>
              <span>
                <span className="font-semibold">{t}</span> <span className="text-ink-soft">— {d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <HowItWorks />
      <PrivacyNote />
    </section>
  );
}
