"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = props.value ?? props.defaultValue ?? [props.min ?? 0];
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center py-3 select-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full border-2 border-ink bg-white">
        <SliderPrimitive.Range className="absolute h-full bg-volt" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={props["aria-label"]}
          className="block size-7 rounded-full border-2 border-ink bg-white shadow-[2px_2px_0_0_var(--color-ink)] outline-none focus-visible:ring-[3px] focus-visible:ring-volt"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
export { Slider };
