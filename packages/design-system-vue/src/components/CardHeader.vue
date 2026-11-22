<script setup lang="ts">
import { cardHeaderClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <div v-bind="mergeAttrs($attrs, cardHeaderClass)"><slot /></div>
</template>
