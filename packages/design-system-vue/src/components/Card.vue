<script setup lang="ts">
import { cardClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <div v-bind="mergeAttrs($attrs, cardClass)"><slot /></div>
</template>
