import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Breadcrumb, BreadcrumbItem, Button, NativeSelect, NavLink } from "@poc/design-system";
import type { Language, SlotId } from "@poc/platform-contracts";
import type { ShellRuntime } from "@poc/shell-state";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  runtime: ShellRuntime;
  onEvent: (type: string, detail?: unknown) => void;
  /** Left side of the top bar (app name, DI mode). */
  brand: ReactNode;
  /** Main column content, below the header slot. */
  children: ReactNode;
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

export function ShellChrome({ runtime, onEvent, brand, children }: Props) {
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
    <section aria-label="Shell chrome" className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="flex flex-wrap items-center gap-4 px-6 py-3">
          {brand}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Language{" "}
              <NativeSelect
                data-testid="language-select"
                value={state.language}
                onChange={(e) => runtime.shellSetLanguage(e.target.value as Language)}
              >
                <option value="en">English</option>
                <option value="th">ไทย</option>
              </NativeSelect>
            </label>
            <span data-testid="shell-user" className="text-sm font-medium">
              {state.user?.displayName ?? "Signed out"}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-6 py-2">
          <h2 data-testid="shell-title" className="m-0 text-lg font-semibold">
            {layout?.title ?? ""}
          </h2>
          <Breadcrumb aria-label="Breadcrumbs" data-testid="shell-breadcrumbs">
            {layout?.breadcrumbs?.map((crumb, i) => (
              <BreadcrumbItem key={i}>
                {crumb.path === undefined ? (
                  <span className="text-foreground">{crumb.label}</span>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-foreground hover:underline"
                    onClick={() => navigate(crumb.path!)}
                  >
                    {crumb.label}
                  </button>
                )}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
          <div className="flex flex-wrap gap-2">
            {layout?.actions?.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
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
              </Button>
            ))}
          </div>
          <code data-testid="shell-path" className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {state.path}
          </code>
        </div>
      </header>
      <div className="grid flex-1 items-start gap-6 p-6 lg:grid-cols-[10rem_minmax(0,1fr)_16rem]">
        <nav aria-label="Shell navigation" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              data-testid={`shell-nav-${item.id}`}
              active={view.activeRemoteId === item.remoteId}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          {/* slot regions carry no text colour or font: slot content brings its own classes */}
          <div data-testid="slot-header" ref={headerRef} className="empty:hidden" />
          {children}
        </div>
        <aside aria-label="Sidebar">
          <div data-testid="slot-sidebar" ref={sidebarRef} className="flex flex-col gap-4" />
        </aside>
      </div>
    </section>
  );
}
