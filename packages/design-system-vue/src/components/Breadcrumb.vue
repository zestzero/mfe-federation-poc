<script setup lang="ts">
import { breadcrumbClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

// Like React: class and data-* land on the inner <ol>, not the <nav>.
defineOptions({ inheritAttrs: false });
// aria-label labels the <nav>; everything else in $attrs goes to the <ol>.
const rest = (attrs: Record<string, unknown>) => {
  const { "aria-label": _l, ...r } = attrs;
  return r;
};
</script>

<template>
  <nav :aria-label="($attrs['aria-label'] as string | undefined) ?? 'breadcrumb'">
    <ol v-bind="mergeAttrs(rest($attrs), breadcrumbClass)"><slot /></ol>
  </nav>
</template>
