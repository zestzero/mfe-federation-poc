import { onScopeDispose, ref, watch } from "vue";
import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client";
import type { SessionSnapshot } from "@poc/platform-contracts";

export const ACCOUNT_SUMMARY_QUERY = gql`
  query AccountSummary {
    accountSummary {
      id
      name
      openOrders
    }
  }
`;

export type RequestHeaders = () => Record<string, string>;

export function createApolloClient(getHeaders: RequestHeaders): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({
      uri: "http://127.0.0.1:4010/graphql",
      fetch: (input, init) => fetch(input, {
        ...init,
        headers: { ...init?.headers, ...getHeaders() },
      }),
    }),
    cache: new InMemoryCache(),
  });
}

export type AccountSummary = { id: string; name: string; openOrders: number };

/**
 * Loads the account summary through the current client. Refetches on account, revision, client or
 * `enabled` change only, and drops responses whose account or revision changed meanwhile.
 */
export function useAccountSummary(
  snapshot: Readonly<{ value: Readonly<SessionSnapshot> }>,
  client: () => ApolloClient,
  enabled: () => boolean,
) {
  const summary = ref<AccountSummary | null>(null);
  const error = ref("");
  const loading = ref(false);
  let requestId = 0;
  const stale = (id: number, account: string, revision: number) =>
    id !== requestId || revision !== snapshot.value.contextRevision || account !== snapshot.value.accountId;

  watch(
    [() => snapshot.value.accountId, () => snapshot.value.contextRevision, enabled, client],
    async ([account, revision, isEnabled, currentClient]) => {
      const id = ++requestId;
      summary.value = null;
      error.value = "";
      if (!account || !isEnabled || snapshot.value.status !== "authenticated") return;
      loading.value = true;
      try {
        const result = await currentClient.query({
          query: ACCOUNT_SUMMARY_QUERY,
          fetchPolicy: "network-only",
          context: {
            headers: {
              "x-poc-session": snapshot.value.subjectId ?? "",
              "x-poc-account": account,
            },
          },
        });
        if (stale(id, account, revision)) return;
        summary.value = (result.data as { accountSummary: AccountSummary }).accountSummary;
      } catch (cause) {
        if (!stale(id, account, revision)) {
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
  return { summary, error, loading };
}
