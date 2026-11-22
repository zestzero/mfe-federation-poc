import { useEffect, useRef, useState } from "react";
import { Badge, Card, CardContent, CardHeader } from "@poc/design-system";
import type { MountHandle, RemoteMount, SessionApi } from "@poc/platform-contracts";
import type { RemoteRegistry } from "@poc/session-coordinator";
import type { ShellRuntime } from "@poc/shell-state";
import type { RemoteLoader, RemoteSlotId } from "./types";

type Props = {
  id: RemoteSlotId;
  title: string;
  mounted: boolean;
  registry: RemoteRegistry;
  runtime: ShellRuntime;
  loadMount: RemoteLoader;
  capabilities: {
    session?: SessionApi;
    resolveSession?: () => SessionApi;
    forceCleanupFail?: boolean;
    onEvent?: (event: { type: string; detail?: unknown }) => void;
  };
  onError: (message: string) => void;
};

function pickMount(mod: { default?: RemoteMount; mount?: RemoteMount }): RemoteMount {
  const mount = mod.mount ?? mod.default;
  if (!mount) throw new Error("Federated remote did not export mount");
  return mount;
}

export function RemoteHost({
  id,
  title,
  mounted,
  registry,
  runtime,
  loadMount,
  capabilities,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<MountHandle | null>(null);
  const [status, setStatus] = useState<"idle" | "mounting" | "mounted" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    const dispose = () => {
      const handle = handleRef.current;
      if (handle) {
        registry.unregister(id);
        runtime.unregisterRemote(id);
        handle.unmount();
        handleRef.current = null;
      }
      if (!cancelled) setStatus("idle");
    };

    if (!mounted) {
      dispose();
      return;
    }

    const el = hostRef.current;
    if (!el) return;

    setStatus("mounting");
    void (async () => {
      try {
        const mod = await loadMount();
        if (cancelled) return;
        const mount = pickMount(mod);
        const shell = runtime.forRemote(id);
        const handle = mount(el, { ...capabilities, shell });
        handleRef.current = handle;
        // The wrapper, not the raw lifecycle: block/dispose must revoke shell contributions first.
        registry.register(id, runtime.registerRemote(id, handle.lifecycle));
        setStatus("mounted");
        capabilities.onEvent?.({ type: "remote.mounted", detail: { id } });
      } catch (error) {
        // cancelled before forRemote; returning first keeps a newer mount's facade intact
        if (cancelled) return;
        // A mount that threw may already have claimed slots or set a layout.
        runtime.unregisterRemote(id);
        setStatus("error");
        onError(error instanceof Error ? error.message : String(error));
        capabilities.onEvent?.({ type: "remote.mount_failed", detail: { id, error: String(error) } });
      }
    })();

    return () => {
      cancelled = true;
      dispose();
      capabilities.onEvent?.({ type: "remote.unmounted", detail: { id } });
    };
    // runtime and registry are memoized once per ShellApp (and per shell App), so they never remount in the normal flow
  }, [mounted, id, capabilities.forceCleanupFail, runtime, registry]);

  return (
    <Card aria-label={title} data-remote={id} data-testid={`remote-host-${id}`} role="region" className="min-w-0 border-t-4 border-t-primary">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        <Badge variant={status === "error" ? "destructive" : status === "mounted" ? "secondary" : "outline"} data-testid={`remote-status-${id}`}>
          {status}
        </Badge>
      </CardHeader>
      {/* no text colour or font here: the remote's root carries its own token classes */}
      <CardContent>
        <div ref={hostRef} data-testid={`remote-root-${id}`} />
      </CardContent>
    </Card>
  );
}
