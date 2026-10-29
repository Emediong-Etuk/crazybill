import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Native <select>: most reliable on low-end Android phones.
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-11 w-full appearance-none rounded-lg border-2 border-ink/25 bg-white pr-10 pl-3 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-volt disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink" aria-hidden />
    </div>
  );
}
export { Select };
