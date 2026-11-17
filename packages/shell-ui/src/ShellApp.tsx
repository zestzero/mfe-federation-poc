import { useCallback, useEffect, useMemo, useState } from "react";
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
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: 0, color: "#64748b" }}>DI mode {diMode} · fictional POC data only</p>
        <h1 style={{ margin: "4px 0" }}>{title}</h1>
        {banner ? (
          <p role="note" data-testid="di-banner" style={{ background: "#fef3c7", padding: 8, borderRadius: 6 }}>
            {banner}
          </p>
        ) : null}
      </header>

      <ShellChrome runtime={runtime} onEvent={pushEvent} />

      <SessionPanel
        session={session}
        busy={busy}
        error={error}
        onLogin={() => void runCommand("login", () => session.requestLogin())}
        onLogout={() => void runCommand("logout", () => session.requestLogout())}
        onSwitchAccount={(accountId) => void runCommand(`account:${accountId}`, () => session.requestAccountChange(accountId))}
      />

      <section aria-label="Remote mount controls" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" data-testid="toggle-react" onClick={() => setReactMounted((v) => !v)}>
          {reactMounted ? "Unmount" : "Mount"} React remote
        </button>
        <button type="button" data-testid="toggle-vue" onClick={() => setVueMounted((v) => !v)}>
          {vueMounted ? "Unmount" : "Mount"} Vue remote
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
    </main>
  );
}
