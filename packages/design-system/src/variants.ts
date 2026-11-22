// Framework-neutral class definitions shared by the React and Vue components.
import { cva } from "class-variance-authority";

export const alertVariants = cva("relative box-border w-full rounded-lg border border-solid px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-card text-card-foreground",
      warning: "border-warning bg-warning/15 text-foreground",
      destructive: "border-destructive bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export const badgeVariants = cva(
  "box-border inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-solid border-border text-foreground",
        warning: "bg-warning text-warning-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const buttonVariants = cva(
  "box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-transparent [font-family:inherit] text-sm font-medium whitespace-nowrap transition-colors outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-solid border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 gap-1.5 px-3" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const navLinkVariants = cva(
  "box-border inline-flex h-8 cursor-pointer items-center rounded-md border-0 bg-transparent px-3 [font-family:inherit] text-sm font-medium transition-colors outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      active: { true: "bg-accent text-accent-foreground", false: "text-muted-foreground" },
    },
    defaultVariants: { active: false },
  },
);

export const cardClass =
  "box-border flex flex-col gap-4 rounded-xl border border-solid border-border bg-card py-5 text-card-foreground shadow-sm";
export const cardHeaderClass = "flex flex-col gap-1.5 px-5";
export const cardTitleClass = "m-0 leading-none font-semibold";
export const cardContentClass = "px-5";
export const inputClass =
  "box-border h-9 w-full min-w-0 rounded-md border border-solid border-input bg-background px-3 py-1 [font-family:inherit] text-sm text-foreground shadow-xs outline-hidden placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
export const nativeSelectClass =
  "box-border h-9 rounded-md border border-solid border-input bg-background py-1 pr-8 pl-3 [font-family:inherit] text-sm text-foreground shadow-xs outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
export const checkboxClass =
  "m-0 box-border size-4 shrink-0 cursor-pointer rounded-sm accent-primary outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
export const breadcrumbClass =
  "m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-muted-foreground";
export const breadcrumbItemClass =
  "inline-flex items-center gap-1.5 not-first:before:content-['/'] not-first:before:text-muted-foreground";
export const definitionListClass =
  "m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm [&>dt]:m-0 [&>dt]:text-muted-foreground [&>dd]:m-0 [&>dd]:text-foreground";
