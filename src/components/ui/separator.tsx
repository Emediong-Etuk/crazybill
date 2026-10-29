import * as React from "react";
import { cn } from "@/lib/utils";

/** Receipt-style dashed perforation. */
function Separator({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="separator" aria-hidden className={cn("perforation my-6", className)} {...props} />;
}
export { Separator };
