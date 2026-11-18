import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { navLinkVariants } from "../variants";

export function NavLink({
  className,
  active,
  type = "button",
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type={type}
      aria-current={active ? "page" : undefined}
      className={cn(navLinkVariants({ active: !!active }), className)}
      {...props}
    />
  );
}
