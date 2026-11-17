<script setup lang="ts">
import { computed } from "vue";
import type { ApolloClient } from "@apollo/client";
import type { RemoteBlockReason, SessionApi, ShellApi } from "@poc/platform-contracts";
import { useAccountSummary } from "./apollo.js";
import { useSessionSnapshot } from "./sessionAdapter.js";
import { useShellState } from "./shellAdapter.js";
import { t } from "./i18n.js";

const props = defineProps<{
  session: SessionApi;
  shell?: ShellApi;
  client: ApolloClient;
  blocked: RemoteBlockReason | null;
  draftNote: string;
}>();

const emit = defineEmits<{ "update:draftNote": [value: string] }>();

const snapshot = useSessionSnapshot(props.session);
const shellState = useShellState(props.shell);
const lang = computed(() => shellState.value?.language ?? "en");
const { summary, error, loading } = useAccountSummary(snapshot, () => props.client, () => !props.blocked);
</script>

<template>
  <main>
    <p v-if="blocked" role="alert">Remote paused: {{ blocked.message }}</p>
    <template v-else>
      <h1 data-testid="vue-heading">{{ t(lang, "heading") }}</h1>
      <small v-if="shell" data-testid="vue-shell-user">
        {{ t(lang, "Shell user") }}: {{ shellState?.user?.displayName ?? "—" }}
      </small>
      <p>Session status: {{ snapshot.status }}</p>
      <p>{{ t(lang, "Account") }}: {{ snapshot.accountId ?? "none" }} (fictional)</p>
      <p v-if="snapshot.status !== 'authenticated'">Sign in to view fictional account details.</p>
      <p v-if="loading">Loading fictional account summary…</p>
      <p v-if="error" role="alert">Could not load account summary: {{ error }}</p>
      <section v-if="summary">
        <h2>{{ summary.name }} (fictional)</h2>
        <p>Open fictional orders: {{ summary.openOrders }}</p>
      </section>
      <label>
        Fictional draft note
        <textarea
          :value="draftNote"
          @input="emit('update:draftNote', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </template>
  </main>
</template>
