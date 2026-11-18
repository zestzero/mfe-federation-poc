<script setup lang="ts">
import { badgeVariants } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ variant?: "default" | "secondary" | "outline" | "warning" | "destructive" }>();
</script>

<template>
  <span v-bind="mergeAttrs($attrs, badgeVariants({ variant: props.variant }))"><slot /></span>
</template>
