import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border-2 border-ink/25 bg-white px-3 text-base text-ink placeholder:text-ink-soft/70 outline-none transition-colors focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-volt disabled:opacity-50 aria-invalid:border-signal",
        className,
      )}
      {...props}
    />
  );
}
export { Input };
