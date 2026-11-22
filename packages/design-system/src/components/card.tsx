import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { cardClass, cardContentClass, cardHeaderClass, cardTitleClass } from "../variants";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardClass, className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardHeaderClass, className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardTitleClass, className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardContentClass, className)} {...props} />;
}
