import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Language, SlotId } from "@poc/platform-contracts";
import type { ShellRuntime } from "@poc/shell-state";

type Props = {
  runtime: ShellRuntime;
  onEvent: (type: string, detail?: unknown) => void;
};

const NAV = [
  { id: "orders", label: "Orders", path: "/orders", remoteId: "react" },
  { id: "summary", label: "Summary", path: "/summary", remoteId: "vue" },
] as const;

const writeHash = (path: string) => {
  if (location.hash.slice(1) !== path) history.replaceState(null, "", `#${path}`);
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Stable ref so re-renders never detach (and thereby clean up) a remote's slot content. */
function useSlotRef(runtime: ShellRuntime, id: SlotId) {
  return useCallback(
    (el: HTMLDivElement | null) => {
      runtime.attachSlotElement(id, el);
    },
    [runtime, id],
  );
}

export function ShellChrome({ runtime, onEvent }: Props) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const view = useSyncExternalStore(runtime.subscribe, runtime.getView);
  const headerRef = useSlotRef(runtime, "header");
  const sidebarRef = useSlotRef(runtime, "sidebar");

  // The hash mirrors `path` with replaceState only: pushed entries would let Back restore an
  // `/orders/<id>` from a previous account. replaceState fires no hashchange, so no loop.
  useEffect(() => {
    const onHashChange = () => {
      try {
        runtime.shellNavigate(location.hash.slice(1));
      } catch {
        // invalid or unknown paths in the hash are ignored
      } finally {
        // a rejected or truncated path must not stay in the address bar
        writeHash(runtime.getState().path);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [runtime]);

  useEffect(() => writeHash(state.path), [state.path]);

  const navigate = (path: string) => {
    try {
      runtime.shellNavigate(path);
    } catch (err) {
      onEvent("shell.navigate.error", { path, message: message(err) });
    }
  };

  const layout = view.layout;

  return (
    <section aria-label="Shell chrome" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #cbd5e1", paddingBottom: 8 }}>
        <h2 data-testid="shell-title" style={{ margin: 0, fontSize: 18 }}>
          {layout?.title ?? ""}
        </h2>
        <nav aria-label="Breadcrumbs" data-testid="shell-breadcrumbs" style={{ display: "flex", gap: 4 }}>
          {layout?.breadcrumbs?.map((crumb, i) =>
            crumb.path === undefined ? (
              <span key={i}>{crumb.label}</span>
            ) : (
              <button key={i} type="button" onClick={() => navigate(crumb.path!)}>
                {crumb.label}
              </button>
            ),
          )}
        </nav>
        <div style={{ display: "flex", gap: 4 }}>
          {layout?.actions?.map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={`shell-action-${action.id}`}
              disabled={action.disabled}
              onClick={() => {
                try {
                  action.onSelect();
                } catch (err) {
                  onEvent("layout.action.error", { id: action.id, message: message(err) });
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto" }} />
        <label>
          Language{" "}
          <select
            data-testid="language-select"
            value={state.language}
            onChange={(e) => runtime.shellSetLanguage(e.target.value as Language)}
          >
            <option value="en">English</option>
            <option value="th">ไทย</option>
          </select>
        </label>
        <span data-testid="shell-user">{state.user?.displayName ?? "Signed out"}</span>
        <code data-testid="shell-path">{state.path}</code>
      </div>
      <div data-testid="slot-header" ref={headerRef} />
      <div style={{ display: "flex", gap: 12 }}>
        <nav aria-label="Shell navigation" style={{ display: "grid", gap: 4, alignContent: "start" }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`shell-nav-${item.id}`}
              aria-current={view.activeRemoteId === item.remoteId ? "page" : undefined}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div data-testid="slot-sidebar" ref={sidebarRef} style={{ flex: 1 }} />
      </div>
    </section>
  );
}
