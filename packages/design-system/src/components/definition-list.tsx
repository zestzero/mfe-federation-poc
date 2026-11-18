import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { definitionListClass } from "../variants";

/** `<dl>` with muted `dt` and normal `dd` children, in a two-column grid. */
export function DefinitionList({ className, ...props }: ComponentProps<"dl">) {
  return <dl className={cn(definitionListClass, className)} {...props} />;
}
