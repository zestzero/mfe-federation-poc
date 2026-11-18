import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { inputClass } from "../variants";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}
