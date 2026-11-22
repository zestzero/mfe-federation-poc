import React, { type Dispatch, type SetStateAction } from "react";
import type { RemoteBlockReason, SessionApi, ShellApi } from "@poc/platform-contracts";
import { useSessionSnapshot } from "./sessionAdapter.js";
import { orderIdFromPath, tryShell, useShellState } from "./shellAdapter.js";
import { useOrders } from "./query.js";
import { t } from "./i18n.js";

export type LocalFeatureState = { draftNote: string };

type AppProps = {
  session: SessionApi;
  shell?: ShellApi;
  blocked: RemoteBlockReason | null;
  localFeature: LocalFeatureState;
  setLocalFeature: Dispatch<SetStateAction<LocalFeatureState>>;
};

export function App({ session, shell, blocked, localFeature, setLocalFeature }: AppProps) {
  const snapshot = useSessionSnapshot(session);
  const shellState = useShellState(shell);
  const ordersQuery = useOrders(session, snapshot.accountId, snapshot.contextRevision, blocked === null);
  const lang = shellState?.language ?? "en";
  const detailId = shell ? orderIdFromPath(shellState?.path) : null;
  const navigate = (path: string) => tryShell(() => shell?.navigate(path));

  if (blocked) {
    return (
      <main>
        <p role="alert">Remote paused: {blocked.message}</p>
      </main>
    );
  }

  const detail = detailId ? ordersQuery.data?.find((order) => order.id === detailId) : undefined;

  return (
    <main>
      <h1 data-testid="react-heading">{t(lang, "Fictional React Orders")}</h1>
      {shell ? (
        <small data-testid="react-shell-user">
          {t(lang, "Shell user")}: {shellState?.user?.displayName ?? "—"}
        </small>
      ) : null}
      <p>Session status: {snapshot.status}</p>
      <p>Account: {snapshot.accountId ?? "none"} (fictional)</p>
      {snapshot.status !== "authenticated" ? <p>{t(lang, "Sign in to view fictional orders.")}</p> : null}
      {ordersQuery.isPending && ordersQuery.fetchStatus !== "idle" ? <p>Loading fictional orders…</p> : null}
      {ordersQuery.isError ? <p role="alert">Could not load orders: {ordersQuery.error.message}</p> : null}
      {detailId && ordersQuery.data ? (
        <section data-testid="react-order-detail">
          {detail ? (
            <p>
              {detail.id}: {detail.description} — {detail.status}
            </p>
          ) : (
            <p>{t(lang, "Order not found")}</p>
          )}
          <button type="button" onClick={() => navigate("/orders")}>
            {t(lang, "Back to orders")}
          </button>
        </section>
      ) : ordersQuery.data ? (
        <ul>
          {ordersQuery.data.map((order) => (
            <li key={order.id}>
              {order.description} — {order.status}
              {shell ? (
                <>
                  {" "}
                  <button type="button" data-testid={`react-order-open-${order.id}`} onClick={() => navigate(`/orders/${order.id}`)}>
                    {t(lang, "Open")}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <label>
        Fictional draft note
        <textarea value={localFeature.draftNote} onChange={(event) => setLocalFeature({ draftNote: event.target.value })} />
      </label>
    </main>
  );
}

/** Header slot content: open-order count from the remote's own query. Nothing while anonymous, `—` while loading. */
export function OpenOrdersBadge({ session, shell }: { session: SessionApi; shell: ShellApi }) {
  const snapshot = useSessionSnapshot(session);
  const shellState = useShellState(shell);
  const ordersQuery = useOrders(session, snapshot.accountId, snapshot.contextRevision, true);
  if (snapshot.status !== "authenticated") return null;
  const count = ordersQuery.data?.filter((order) => order.status === "open").length;
  return (
    <span data-testid="react-open-orders">
      {t(shellState?.language ?? "en", "Open orders")}: {count ?? "—"}
    </span>
  );
}

// Keep React referenced for federated shared-scope edge cases.
void React;
