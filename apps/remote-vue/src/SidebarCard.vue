<script setup lang="ts">
import { computed } from "vue";
import type { ApolloClient } from "@apollo/client";
import type { Language, SessionApi, ShellApi } from "@poc/platform-contracts";
import { useAccountSummary } from "./apollo.js";
import { useSessionSnapshot } from "./sessionAdapter.js";
import { tryShell, useShellState } from "./shellAdapter.js";
import { t } from "./i18n.js";

const props = defineProps<{ session: SessionApi; shell: ShellApi; client: ApolloClient }>();

const snapshot = useSessionSnapshot(props.session);
const shellState = useShellState(props.shell);
const lang = computed(() => shellState.value?.language ?? "en");
const { summary } = useAccountSummary(snapshot, () => props.client, () => true);

const onLanguage = (event: Event) => {
  const code = (event.target as HTMLSelectElement).value as Language;
  tryShell(() => props.shell.setLanguage(code));
};
</script>

<template>
  <aside data-testid="vue-sidebar-card">
    <template v-if="snapshot.status === 'authenticated'">
      <p>{{ t(lang, "Account") }}: <span data-testid="vue-sidebar-account">{{ summary?.name ?? "—" }}</span></p>
      <p>{{ t(lang, "Open orders") }}: <span data-testid="vue-sidebar-open-orders">{{ summary?.openOrders ?? "—" }}</span></p>
    </template>
    <label>
      {{ t(lang, "Language") }}
      <select data-testid="vue-language-picker" :value="lang" @change="onLanguage">
        <option value="en">English</option>
        <option value="th">ไทย</option>
      </select>
    </label>
  </aside>
</template>
