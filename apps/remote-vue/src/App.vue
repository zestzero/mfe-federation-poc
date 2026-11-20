<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import type { ApolloClient } from "@apollo/client";
import type { RemoteBlockReason, SessionApi } from "@poc/platform-contracts";
import { ACCOUNT_SUMMARY_QUERY } from "./apollo.js";
import { useSessionSnapshot } from "@poc/remote-kit/vue";

const props = defineProps<{
  session: SessionApi;
  client: ApolloClient;
  blocked: RemoteBlockReason | null;
  draftNote: string;
}>();

const emit = defineEmits<{ "update:draftNote": [value: string] }>();

const snapshot = useSessionSnapshot(props.session);
const summary = ref<{ id: string; name: string; openOrders: number } | null>(null);
const error = ref("");
const loading = ref(false);
let requestId = 0;
const accountId = computed(() => snapshot.value.accountId);

watch(
  [accountId, () => snapshot.value.contextRevision, () => props.blocked, () => props.client],
  async ([account, revision, blocked]) => {
    const id = ++requestId;
    summary.value = null;
    error.value = "";
    if (!account || blocked || snapshot.value.status !== "authenticated") return;
    loading.value = true;
    try {
      const result = await props.client.query({
        query: ACCOUNT_SUMMARY_QUERY,
        fetchPolicy: "network-only",
        context: {
          headers: {
            "x-poc-session": snapshot.value.subjectId ?? "",
            "x-poc-account": account,
          },
        },
      });
      if (id !== requestId || revision !== snapshot.value.contextRevision) return;
      summary.value = result.data.accountSummary;
    } catch (cause) {
      if (id === requestId && revision === snapshot.value.contextRevision) {
        error.value = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (id === requestId) loading.value = false;
    }
  },
  { immediate: true },
);

onScopeDispose(() => {
  requestId++;
});
</script>

<template>
  <main>
    <p v-if="blocked" role="alert">Remote paused: {{ blocked.message }}</p>
    <template v-else>
      <h1>Fictional Vue Account Summary</h1>
      <p>Session status: {{ snapshot.status }}</p>
      <p>Account: {{ snapshot.accountId ?? "none" }} (fictional)</p>
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
