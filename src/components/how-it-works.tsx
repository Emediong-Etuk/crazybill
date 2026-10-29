"use client";

import { ChevronDown, Eye, FileText, Search, Calculator } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STEPS = [
  {
    icon: Eye,
    title: "Read the photo",
    body: "NVIDIA Nemotron 3.5 Super VL reads every field on the bill or receipt. You check and fix them.",
  },
  {
    icon: Calculator,
    title: "Check the maths",
    body: "Plain TypeScript recomputes readings, kWh × rate, VAT, totals and token units. No AI does money maths.",
  },
  {
    icon: Search,
    title: "Research the rules",
    body: "Nemotron 3 Ultra runs as an agent with Tavily search + extract to find the current NERC tariff, band hours and complaint rules — every claim cites a page it actually retrieved.",
  },
  {
    icon: FileText,
    title: "Write the complaint",
    body: "Code calculates the ₦ overcharge. Nemotron 3.5 Lightning drafts a formal letter and a Pidgin summary.",
  },
];

const GLOSSARY = [
  ["DisCo", "Electricity Distribution Company — the private company that bills you (e.g. Ikeja Electric, PHED)."],
  ["NERC", "Nigerian Electricity Regulatory Commission — the regulator that approves tariffs and handles complaints."],
  ["Band A–E", "Tariff bands by promised supply: Band A ≥ 20 h/day pays the most; lower bands get fewer hours and pay less."],
  ["Prepaid token", "A 20-digit code bought in advance and typed into the meter; the receipt shows the units (kWh) you got."],
  ["Estimated (\"crazy\") bill", "A bill not based on a real meter reading — a common source of overcharging."],
  ["NEPA", "The old national power authority. Nigerians still call the light bill \"NEPA bill\"."],
];

export function HowItWorks() {
  return (
    <Collapsible className="rounded-xl border-2 border-ink bg-white">
      <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left font-heading font-extrabold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-volt rounded-xl">
        How CrazyBill works
        <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="relative flex flex-col items-center">
                <span className="grid size-9 place-items-center rounded-lg border-2 border-ink bg-volt">
                  <s.icon className="size-5" aria-hidden />
                </span>
                {i < STEPS.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-ink/20" aria-hidden />}
              </span>
              <span className="pb-1">
                <span className="font-mono text-xs text-ink-soft">STEP {i + 1}</span>
                <span className="block font-semibold">{s.title}</span>
                <span className="text-sm text-ink-soft">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="perforation my-4" aria-hidden />
        <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">Glossary</h3>
        <dl className="grid gap-2 text-sm">
          {GLOSSARY.map(([t, d]) => (
            <div key={t}>
              <dt className="inline font-semibold">{t}: </dt>
              <dd className="inline text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-soft">All AI inference runs on Nebius Token Factory using NVIDIA Nemotron models.</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
