import React, { type Dispatch, type SetStateAction } from "react";
import type { RemoteBlockReason, SessionApi, ShellApi } from "@poc/platform-contracts";
import { Alert, Badge, Button, Card, CardContent, cn } from "@poc/design-system";
import { inputClass } from "@poc/design-system/variants";
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
      <main className="text-foreground tabular-nums">
        <Alert variant="warning" role="alert">
          Remote paused: {blocked.message}
        </Alert>
      </main>
    );
  }

  const detail = detailId ? ordersQuery.data?.find((order) => order.id === detailId) : undefined;

  return (
    <main className="flex flex-col gap-4 text-foreground tabular-nums">
      <div className="flex flex-col gap-1">
        <h1 data-testid="react-heading" className="m-0 text-lg font-semibold tracking-tight">
          {t(lang, "Fictional React Orders")}
        </h1>
        {shell ? (
          <small data-testid="react-shell-user" className="text-muted-foreground">
            {t(lang, "Shell user")}: {shellState?.user?.displayName ?? "—"}
          </small>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        <p className="m-0">Session status: {snapshot.status}</p>
        <p className="m-0">Account: {snapshot.accountId ?? "none"} (fictional)</p>
      </div>
      {snapshot.status !== "authenticated" ? (
        <p className="m-0 text-sm text-muted-foreground">{t(lang, "Sign in to view fictional orders.")}</p>
      ) : null}
      {ordersQuery.isPending && ordersQuery.fetchStatus !== "idle" ? (
        <p className="m-0 text-sm text-muted-foreground">Loading fictional orders…</p>
      ) : null}
      {ordersQuery.isError ? (
        <Alert variant="destructive" role="alert">
          Could not load orders: {ordersQuery.error.message}
        </Alert>
      ) : null}
      {detailId && ordersQuery.data ? (
        <section data-testid="react-order-detail" className="flex flex-col items-start gap-3">
          {detail ? (
            <Card className="w-full py-4">
              <CardContent className="flex items-center gap-2 text-sm">
                <span>
                  {detail.id}: {detail.description} —
                </span>
                <Badge variant="outline">{detail.status}</Badge>
              </CardContent>
            </Card>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">{t(lang, "Order not found")}</p>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/orders")}>
            {t(lang, "Back to orders")}
          </Button>
        </section>
      ) : ordersQuery.data ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ordersQuery.data.map((order) => (
            <li key={order.id}>
              <Card className="py-3">
                <CardContent className="flex items-center gap-2 text-sm">
                  <span>{order.description} —</span>
                  <Badge variant="secondary">{order.status}</Badge>
                  {shell ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      data-testid={`react-order-open-${order.id}`}
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      {t(lang, "Open")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Fictional draft note
        <textarea
          className={cn(inputClass, "h-24 resize-y py-2")}
          value={localFeature.draftNote}
          onChange={(event) => setLocalFeature({ draftNote: event.target.value })}
        />
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
    <Badge variant="secondary" data-testid="react-open-orders">
      {t(shellState?.language ?? "en", "Open orders")}: {count ?? "—"}
    </Badge>
  );
}

// Keep React referenced for federated shared-scope edge cases.
void React;
