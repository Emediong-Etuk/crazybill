import { ExternalLink } from "lucide-react";
import { domainOf } from "@/lib/format";

export function SourceChip({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-ink/30 bg-paper px-2.5 font-mono text-xs hover:border-ink hover:bg-volt focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-volt"
    >
      <span className="truncate">{domainOf(url)}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens source in new tab)</span>
    </a>
  );
}
