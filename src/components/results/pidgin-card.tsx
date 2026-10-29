"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareText, whatsappUrl } from "@/lib/share";

export function PidginCard({ pidgin, appUrl }: { pidgin: string; appUrl: string }) {
  return (
    <section aria-labelledby="pidgin" lang="pcm" className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-volt p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
      <h2 id="pidgin" className="font-mono text-xs font-bold uppercase tracking-widest" lang="en">
        For Pidgin — tell your neighbour
      </h2>
      <p className="text-lg leading-snug font-semibold">{pidgin}</p>
      <Button asChild variant="ink" className="w-fit">
        <a href={whatsappUrl(shareText(pidgin, appUrl))} target="_blank" rel="noreferrer noopener" lang="en">
          <MessageCircle /> Share to WhatsApp
        </a>
      </Button>
    </section>
  );
}
