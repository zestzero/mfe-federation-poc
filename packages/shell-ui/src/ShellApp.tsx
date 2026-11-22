import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button } from "@poc/design-system";
import { createShellRuntime } from "@poc/shell-state";
import { FICTIONAL_USERS } from "@poc/test-support";
import { SessionPanel } from "./SessionPanel";
import { RemoteHost } from "./RemoteHost";
import { ScenarioControls } from "./ScenarioControls";
import { EventLog, appendEvent } from "./EventLog";
import { ShellChrome } from "./ShellChrome";
import type { ShellEvent, ShellUiProps } from "./types";

const ROUTES = { "/orders": "react", "/summary": "vue" };
const resolveUser = (subjectId: string) =>
  FICTIONAL_USERS[subjectId as keyof typeof FICTIONAL_USERS] ?? null;

export function ShellApp({
  diMode,
  title,
  banner,
  session,
  registry,
  resolveRemoteCapabilities,
  loadReactMount,
  loadVueMount,
}: ShellUiProps) {
  const [events, setEvents] = useState<ShellEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactMounted, setReactMounted] = useState(true);
  const [vueMounted, setVueMounted] = useState(true);
  const [forceCleanupFail, setForceCleanupFail] = useState(false);

  // ponytail: runtime created in useMemo and disposed in an effect. Fine without StrictMode (not enabled);
  // under StrictMode the double effect run would dispose the memoized runtime and leave it dead.
  // Upgrade path: create the runtime in a ref/effect (create on mount, dispose on unmount).
  const runtime = useMemo(() => {
    const created = createShellRuntime({ session, routes: ROUTES, resolveUser });
    try {
      // deep link: start from a valid path in the hash, ignore anything else
      created.shellNavigate(location.hash.slice(1));
    } catch {
      // keep the default path
    }
    return created;
  }, [session]);
  useEffect(() => () => runtime.dispose(), [runtime]);

  const pushEvent = useCallback((type: string, detail?: unknown) => {
    setEvents((prev) => appendEvent(prev, type, detail));
  }, []);

  const capabilities = useMemo(
    () =>
      resolveRemoteCapabilities({
        forceCleanupFail,
        onEvent: (event) => pushEvent(event.type, event.detail),
      }),
    [forceCleanupFail, pushEvent, resolveRemoteCapabilities],
  );

  const runCommand = async (label: string, action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    pushEvent("session.command", { label });
    try {
      await action();
      pushEvent("session.command.ok", { label, revision: session.getSnapshot().contextRevision });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pushEvent("session.command.error", { label, message });
    } finally {
      setBusy(false);
    }
  };

  return (
    // `antialiased` is used only here: check-built-css.mjs (the shells' check:css) uses it as the probe
    // that proves the shell build scans packages/shell-ui sources. Keep it or change the probe there.
    <main className="antialiased min-h-screen bg-background">
      <ShellChrome
        runtime={runtime}
        onEvent={pushEvent}
        brand={
          <div>
            <p className="m-0 text-xs text-muted-foreground">DI mode {diMode} · fictional POC data only</p>
            <h1 className="m-0 text-xl font-semibold tracking-tight">{title}</h1>
          </div>
        }
      >
        {banner ? (
          <Alert variant="warning" role="note" data-testid="di-banner">
            {banner}
          </Alert>
        ) : null}

        <SessionPanel
          session={session}
          busy={busy}
          error={error}
          onLogin={() => void runCommand("login", () => session.requestLogin())}
          onLogout={() => void runCommand("logout", () => session.requestLogout())}
          onSwitchAccount={(accountId) => void runCommand(`account:${accountId}`, () => session.requestAccountChange(accountId))}
        />

        <section aria-label="Remote mount controls" className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" data-testid="toggle-react" onClick={() => setReactMounted((v) => !v)}>
            {reactMounted ? "Unmount" : "Mount"} React remote
          </Button>
          <Button variant="outline" size="sm" data-testid="toggle-vue" onClick={() => setVueMounted((v) => !v)}>
            {vueMounted ? "Unmount" : "Mount"} Vue remote
          </Button>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <RemoteHost
            id="react"
            title="React + TanStack Query (fictional orders)"
            mounted={reactMounted}
            registry={registry}
            runtime={runtime}
            loadMount={loadReactMount}
            capabilities={capabilities}
            onError={setError}
          />
          <RemoteHost
            id="vue"
            title="Vue + Apollo (fictional summary)"
            mounted={vueMounted}
            registry={registry}
            runtime={runtime}
            loadMount={loadVueMount}
            capabilities={capabilities}
            onError={setError}
          />
        </div>

        <ScenarioControls
          forceCleanupFail={forceCleanupFail}
          onForceCleanupFailChange={setForceCleanupFail}
          onEvent={pushEvent}
        />

        <EventLog events={events} onClear={() => setEvents([])} />
      </ShellChrome>
    </main>
  );
}
