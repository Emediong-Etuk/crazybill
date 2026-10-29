import { Zap } from "lucide-react";
import { Flow } from "@/components/flow";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg border-2 border-ink bg-volt shadow-[2px_2px_0_0_var(--color-ink)]">
            <Zap className="size-5 fill-ink" aria-hidden />
          </span>
          <span className="font-heading text-xl font-black tracking-tight">CrazyBill</span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Nigeria · NERC</span>
      </header>
      <main>
        <Flow />
      </main>
      <SiteFooter />
    </div>
  );
}
