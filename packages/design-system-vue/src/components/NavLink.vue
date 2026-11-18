<script setup lang="ts">
import { navLinkVariants } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ active?: boolean }>();
</script>

<template>
  <button
    type="button"
    :aria-current="props.active ? 'page' : undefined"
    v-bind="mergeAttrs($attrs, navLinkVariants({ active: !!props.active }))"
  >
    <slot />
  </button>
</template>
