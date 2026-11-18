<script setup lang="ts">
import { computed } from "vue";
import type { ApolloClient } from "@apollo/client";
import type { Language, SessionApi, ShellApi } from "@poc/platform-contracts";
import { Card, CardContent, NativeSelect } from "@poc/design-system-vue";
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
  <Card data-testid="vue-sidebar-card" class="py-3">
    <CardContent class="flex flex-col gap-2 text-sm">
      <template v-if="snapshot.status === 'authenticated'">
        <p class="m-0">{{ t(lang, "Account") }}: <span data-testid="vue-sidebar-account">{{ summary?.name ?? "—" }}</span></p>
        <p class="m-0">{{ t(lang, "Open orders") }}: <span data-testid="vue-sidebar-open-orders">{{ summary?.openOrders ?? "—" }}</span></p>
      </template>
      <label class="flex flex-col gap-1.5 font-medium">
        {{ t(lang, "Language") }}
        <NativeSelect data-testid="vue-language-picker" :value="lang" @change="onLanguage">
          <option value="en">English</option>
          <option value="th">ไทย</option>
        </NativeSelect>
      </label>
    </CardContent>
  </Card>
</template>
