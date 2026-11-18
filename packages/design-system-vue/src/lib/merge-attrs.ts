import { cn } from "@poc/design-system/utils";
import type { ClassValue } from "clsx";

// v-model is intentionally NOT supported on the native-element components (Input, NativeSelect,
// Checkbox): they are controlled native elements, use `:value` / `:checked` plus `@input` / `@change`.
// `modelValue` and `onUpdate:modelValue` are stripped so they never leak onto the DOM as junk attributes.

/** Fall-through attrs with `class` merged via twMerge, so overrides win like React `cn()`. */
export function mergeAttrs(attrs: Record<string, unknown>, base: string): Record<string, unknown> {
  const { class: cls, modelValue: _m, "onUpdate:modelValue": _u, ...rest } = attrs;
  return { ...rest, class: cn(base, cls as ClassValue) };
}
