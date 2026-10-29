import { ShieldCheck } from "lucide-react";

export function PrivacyNote() {
  return (
    <p className="flex gap-2 rounded-lg bg-paper-deep p-3 text-sm text-ink-soft">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
      <span>
        Your photo is read and discarded. We don&apos;t store it. Names and addresses never leave the reading step.
      </span>
    </p>
  );
}
