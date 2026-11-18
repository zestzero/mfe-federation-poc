<script setup lang="ts">
import { cardTitleClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <div v-bind="mergeAttrs($attrs, cardTitleClass)"><slot /></div>
</template>
