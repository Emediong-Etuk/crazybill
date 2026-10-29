"use client";

import { useState } from "react";
import { Copy, Download, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyText, downloadText, shareText, whatsappUrl } from "@/lib/share";

export function LetterPanel({ initial, pidgin, appUrl, personalised }: { initial: string; pidgin: string; appUrl: string; personalised: boolean }) {
  const [text, setText] = useState(initial);
  return (
    <section aria-labelledby="letter" className="flex flex-col gap-3">
      <div>
        <h2 id="letter" className="font-heading text-xl font-extrabold">
          Your complaint letter
        </h2>
        <p className="text-sm text-ink-soft">
          Edit it, then send it to your DisCo&apos;s Customer Complaints Unit.
          {personalised ? " Your name and address were filled in on this phone — they were never sent to the research step." : " Replace the [bracketed] parts with your details."}
        </p>
      </div>
      <label htmlFor="letter-text" className="sr-only">
        Complaint letter
      </label>
      <Textarea
        id="letter-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[420px] font-mono text-[13px] leading-relaxed"
        spellCheck
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          variant="outline"
          onClick={async () => {
            if (await copyText(text)) toast.success("Letter copied");
            else toast.error("Couldn't copy — select the text and copy it manually");
          }}
        >
          <Copy /> Copy
        </Button>
        <Button variant="outline" onClick={() => downloadText("crazybill-complaint.txt", text)}>
          <Download /> Download
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Print / PDF
        </Button>
        <Button asChild variant="ink">
          <a href={whatsappUrl(shareText(pidgin, appUrl))} target="_blank" rel="noreferrer noopener">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      </div>
      <div id="print-letter" className="hidden" aria-hidden>
        {text}
      </div>
    </section>
  );
}
