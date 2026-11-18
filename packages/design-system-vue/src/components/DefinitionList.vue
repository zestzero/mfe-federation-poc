<script setup lang="ts">
import { definitionListClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <dl v-bind="mergeAttrs($attrs, definitionListClass)"><slot /></dl>
</template>
