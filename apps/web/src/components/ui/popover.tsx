import type { ComponentProps } from "react";
import { Popover as Primitive } from "radix-ui";
import { cn } from "@/lib/utils.js";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export function PopoverContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("z-50 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none", className)} {...props} /></Primitive.Portal>;
}
