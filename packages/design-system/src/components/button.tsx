import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { buttonVariants } from "../variants";

export { buttonVariants };

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
