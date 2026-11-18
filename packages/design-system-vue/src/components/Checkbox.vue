<script setup lang="ts">
import { checkboxClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

// No v-model by design: use :value/:checked with @input/@change (see lib/merge-attrs.ts).
defineOptions({ inheritAttrs: false });
</script>

<template>
  <input v-bind="mergeAttrs($attrs, checkboxClass)" type="checkbox" />
</template>
