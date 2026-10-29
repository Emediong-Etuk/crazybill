import { Search } from "lucide-react";
import { domainOf } from "@/lib/format";
import type { AuditResult } from "@/lib/schemas";

export function SourcesList({ result }: { result: AuditResult }) {
  return (
    <section aria-labelledby="sources" className="flex flex-col gap-3">
      <h2 id="sources" className="font-heading text-xl font-extrabold">
        Sources
      </h2>
      <p className="text-sm text-ink-soft">
        Every link below was actually retrieved by Tavily during this audit. Any URL the AI cited that Tavily didn&apos;t return is removed automatically.
      </p>
      {result.sources.length === 0 ? (
        <p className="text-sm">No verified sources in this run.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {result.sources.map((s, i) => (
            <li key={s.url} className="rounded-lg border-2 border-ink/20 bg-white p-3">
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-semibold underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                <span className="mr-1 font-mono text-xs text-ink-soft">[{i + 1}]</span>
                {s.title || domainOf(s.url)}
              </a>
              <p className="font-mono text-xs text-ink-soft">{domainOf(s.url)}</p>
              <p className="mt-1 text-sm">
                <span className="text-ink-soft">Used for: </span>
                {s.usedFor}
              </p>
            </li>
          ))}
        </ol>
      )}
      {result.tavilyQueries.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">Searches the agent ran</h3>
          <ul className="flex flex-col gap-1">
            {result.tavilyQueries.map((q, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-xs">
                <Search className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
