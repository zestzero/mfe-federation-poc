import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { alertVariants } from "../variants";

export { alertVariants };

export function Alert({
  className,
  variant,
  role,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role={role ?? (variant === "warning" || variant === "destructive" ? "alert" : undefined)}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
