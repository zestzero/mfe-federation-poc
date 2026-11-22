<script setup lang="ts">
import { cardContentClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <div v-bind="mergeAttrs($attrs, cardContentClass)"><slot /></div>
</template>
