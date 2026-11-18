import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { checkboxClass } from "../variants";

/** Styled native checkbox; `accent-primary` colours the box from the token. */
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn(checkboxClass, className)} {...props} />;
}
