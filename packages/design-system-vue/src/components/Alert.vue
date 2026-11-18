<script setup lang="ts">
import { alertVariants } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ variant?: "default" | "warning" | "destructive" }>();
</script>

<template>
  <!-- explicit role attr (later v-bind) wins over the default -->
  <div
    :role="props.variant === 'warning' || props.variant === 'destructive' ? 'alert' : undefined"
    v-bind="mergeAttrs($attrs, alertVariants({ variant: props.variant }))"
  >
    <slot />
  </div>
</template>
