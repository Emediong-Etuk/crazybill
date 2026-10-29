import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper",
        outline: "border-ink/30 text-ink",
        high: "border-signal bg-signal text-white",
        medium: "border-amber bg-amber/15 text-[#8a5300]",
        low: "border-ink/30 bg-ink/5 text-ink-soft",
        pass: "border-pass bg-pass/10 text-pass",
        volt: "border-ink bg-volt text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
