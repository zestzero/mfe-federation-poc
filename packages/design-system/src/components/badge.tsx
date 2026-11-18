import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { badgeVariants } from "../variants";

export { badgeVariants };

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
