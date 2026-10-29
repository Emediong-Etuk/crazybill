import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border-2 border-ink/25 bg-white px-3 py-2 text-base text-ink placeholder:text-ink-soft/70 outline-none focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-volt disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
export { Textarea };
