<script setup lang="ts">
import { breadcrumbItemClass } from "@poc/design-system/variants";
import { mergeAttrs } from "../lib/merge-attrs";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <li v-bind="mergeAttrs($attrs, breadcrumbItemClass)"><slot /></li>
</template>
