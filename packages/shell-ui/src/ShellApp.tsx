import { useCallback, useMemo, useState } from "react";
import { SessionPanel } from "./SessionPanel";
import { RemoteHost } from "./RemoteHost";
import { ScenarioControls } from "./ScenarioControls";
import { EventLog, appendEvent } from "./EventLog";
import type { ShellEvent, ShellUiProps } from "./types";

export function ShellApp({
  diMode,
  title,
  banner,
  session,
  registry,
  resolveRemoteCapabilities,
  remotes,
}: ShellUiProps) {
  const [events, setEvents] = useState<ShellEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState<Record<string, boolean>>({});
  const [forceCleanupFail, setForceCleanupFail] = useState(false);

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

  const isMounted = (id: string) => mounted[id] ?? true;

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

      <SessionPanel
        session={session}
        busy={busy}
        error={error}
        onLogin={() => void runCommand("login", () => session.requestLogin())}
        onLogout={() => void runCommand("logout", () => session.requestLogout())}
        onSwitchAccount={(accountId) => void runCommand(`account:${accountId}`, () => session.requestAccountChange(accountId))}
      />

      <section aria-label="Remote mount controls" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {remotes.map((remote) => (
          <button
            key={remote.id}
            type="button"
            data-testid={`toggle-${remote.id}`}
            onClick={() =>
              setMounted((current) => ({ ...current, [remote.id]: !(current[remote.id] ?? true) }))
            }
          >
            {isMounted(remote.id) ? "Unmount" : "Mount"} {remote.title}
          </button>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {remotes.map((remote) => (
          <RemoteHost
            key={remote.id}
            id={remote.id}
            title={remote.title}
            mounted={isMounted(remote.id)}
            registry={registry}
            loadMount={remote.load}
            capabilities={capabilities}
            onError={setError}
          />
        ))}
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
