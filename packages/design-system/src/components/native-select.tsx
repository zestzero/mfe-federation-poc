import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { nativeSelectClass } from "../variants";

/** Styled native <select>; no portal, so e2e `selectOption` keeps working. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(nativeSelectClass, className)} {...props} />;
}
