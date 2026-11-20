import React, { type Dispatch, type SetStateAction } from "react";
import type { RemoteBlockReason, SessionApi } from "@poc/platform-contracts";
import { useSessionSnapshot } from "@poc/remote-kit/react";
import { useOrders } from "./query.js";

export type LocalFeatureState = { draftNote: string };

type AppProps = {
  session: SessionApi;
  blocked: RemoteBlockReason | null;
  localFeature: LocalFeatureState;
  setLocalFeature: Dispatch<SetStateAction<LocalFeatureState>>;
};

export function App({ session, blocked, localFeature, setLocalFeature }: AppProps) {
  const snapshot = useSessionSnapshot(session);
  const ordersQuery = useOrders(session, snapshot.accountId, snapshot.contextRevision, blocked === null);

  if (blocked) {
    return (
      <main>
        <p role="alert">Remote paused: {blocked.message}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Fictional React Orders</h1>
      <p>Session status: {snapshot.status}</p>
      <p>Account: {snapshot.accountId ?? "none"} (fictional)</p>
      {snapshot.status !== "authenticated" ? <p>Sign in to view fictional orders.</p> : null}
      {ordersQuery.isPending && ordersQuery.fetchStatus !== "idle" ? <p>Loading fictional orders…</p> : null}
      {ordersQuery.isError ? <p role="alert">Could not load orders: {ordersQuery.error.message}</p> : null}
      {ordersQuery.data ? (
        <ul>
          {ordersQuery.data.map((order) => (
            <li key={order.id}>{order.description} — {order.status}</li>
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

// Keep React referenced for federated shared-scope edge cases.
void React;
