import { useSyncExternalStore } from "react";
import type { SessionApi } from "@poc/platform-contracts";
import { Alert, Button, Card, CardContent, CardHeader, DefinitionList } from "@poc/design-system";
import { FICTIONAL_ACCOUNTS, FICTIONAL_USERS } from "@poc/test-support";

type Props = {
  session: SessionApi;
  busy: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onSwitchAccount: (accountId: string) => void;
};

export function SessionPanel({
  session,
  busy,
  error,
  onLogin,
  onLogout,
  onSwitchAccount,
}: Props) {
  const snapshot = useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
  const userLabel =
    snapshot.subjectId && snapshot.subjectId in FICTIONAL_USERS
      ? FICTIONAL_USERS[snapshot.subjectId as keyof typeof FICTIONAL_USERS].displayName
      : snapshot.subjectId ?? "none";
  const accountLabel =
    snapshot.accountId && snapshot.accountId in FICTIONAL_ACCOUNTS
      ? FICTIONAL_ACCOUNTS[snapshot.accountId as keyof typeof FICTIONAL_ACCOUNTS].name
      : snapshot.accountId ?? "none";

  return (
    <Card aria-label="Session controls" role="region" data-testid="session-panel">
      <CardHeader>
        <h2 className="m-0 text-base font-semibold">Session (fictional)</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DefinitionList>
          <dt>Status</dt>
          <dd data-testid="session-status">{snapshot.status}</dd>
          <dt>User</dt>
          <dd data-testid="session-user">{userLabel}</dd>
          <dt>Account</dt>
          <dd data-testid="session-account">{accountLabel}</dd>
          <dt>Context revision</dt>
          <dd data-testid="session-revision">{snapshot.contextRevision}</dd>
          <dt>Contract version</dt>
          <dd>{session.contractVersion}</dd>
        </DefinitionList>
        {error ? (
          <Alert variant="destructive" role="alert" data-testid="session-error">
            {error}
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" data-testid="login" disabled={busy} onClick={onLogin}>
            Login (Ava / North)
          </Button>
          <Button variant="outline" size="sm" data-testid="logout" disabled={busy} onClick={onLogout}>
            Logout
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="switch-north"
            disabled={busy}
            onClick={() => onSwitchAccount("acct_north")}
          >
            Switch to North
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="switch-south"
            disabled={busy}
            onClick={() => onSwitchAccount("acct_south")}
          >
            Switch to South
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
