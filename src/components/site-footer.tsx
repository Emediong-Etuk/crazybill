import { FolderGit2 } from "lucide-react";

export function SiteFooter() {
  const repo = process.env.NEXT_PUBLIC_REPO_URL;
  return (
    <footer className="mt-12 flex flex-col gap-2 border-t-2 border-dashed border-ink/25 pt-5 pb-8 text-xs text-ink-soft">
      <p className="font-semibold text-ink">Informational only — not legal advice.</p>
      <p>Built with NVIDIA Nemotron on Nebius Token Factory · Search by Tavily</p>
      {repo && (
        <a href={repo} className="inline-flex w-fit items-center gap-1 underline underline-offset-2 hover:text-ink" target="_blank" rel="noreferrer">
          <FolderGit2 className="size-3.5" aria-hidden /> Source on GitHub (MIT)
        </a>
      )}
    </footer>
  );
}
