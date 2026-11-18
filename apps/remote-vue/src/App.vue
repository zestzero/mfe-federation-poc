<script setup lang="ts">
import { computed } from "vue";
import type { ApolloClient } from "@apollo/client";
import type { RemoteBlockReason, SessionApi, ShellApi } from "@poc/platform-contracts";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@poc/design-system-vue";
import { cn } from "@poc/design-system/utils";
import { inputClass } from "@poc/design-system/variants";
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
  <main class="text-foreground slashed-zero">
    <Alert v-if="blocked" variant="warning" role="alert">Remote paused: {{ blocked.message }}</Alert>
    <div v-else class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h1 data-testid="vue-heading" class="m-0 text-lg font-semibold tracking-tight">{{ t(lang, "heading") }}</h1>
        <small v-if="shell" data-testid="vue-shell-user" class="text-muted-foreground">
          {{ t(lang, "Shell user") }}: {{ shellState?.user?.displayName ?? "—" }}
        </small>
      </div>
      <div class="flex flex-col gap-0.5 text-sm text-muted-foreground">
        <p class="m-0">Session status: {{ snapshot.status }}</p>
        <p class="m-0">{{ t(lang, "Account") }}: {{ snapshot.accountId ?? "none" }} (fictional)</p>
      </div>
      <p v-if="snapshot.status !== 'authenticated'" class="m-0 text-sm text-muted-foreground">Sign in to view fictional account details.</p>
      <p v-if="loading" class="m-0 text-sm text-muted-foreground">Loading fictional account summary…</p>
      <Alert v-if="error" variant="destructive" role="alert">Could not load account summary: {{ error }}</Alert>
      <section v-if="summary">
      <Card data-testid="vue-summary" class="py-4">
        <CardHeader>
          <CardTitle><h2 class="m-0 text-base font-semibold">{{ summary.name }} (fictional)</h2></CardTitle>
        </CardHeader>
        <CardContent class="text-sm">
          <p class="m-0">Open fictional orders: {{ summary.openOrders }}</p>
        </CardContent>
      </Card>
      </section>
      <label class="flex flex-col gap-1.5 text-sm font-medium">
        Fictional draft note
        <textarea
          :class="cn(inputClass, 'h-24 resize-y py-2')"
          :value="draftNote"
          @input="emit('update:draftNote', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>
  </main>
</template>
