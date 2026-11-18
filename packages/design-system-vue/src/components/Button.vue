<script setup lang="ts">
import { buttonVariants } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
const props = defineProps<{
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm";
}>();
</script>

<template>
  <button type="button" v-bind="mergeAttrs($attrs, buttonVariants({ variant: props.variant, size: props.size }))"><slot /></button>
</template>
