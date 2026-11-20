import { useEffect, useRef, useState } from "react";
import type { MountHandle, RemoteMount, SessionApi } from "@poc/platform-contracts";
import type { RemoteRegistry } from "@poc/session-coordinator";
import type { RemoteLoader } from "./types";

type Props = {
  id: string;
  title: string;
  mounted: boolean;
  registry: RemoteRegistry;
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
        const handle = mount(el, capabilities);
        handleRef.current = handle;
        registry.register(id, handle.lifecycle);
        setStatus("mounted");
        capabilities.onEvent?.({ type: "remote.mounted", detail: { id } });
      } catch (error) {
        if (cancelled) return;
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
  }, [mounted, id, capabilities.forceCleanupFail]);

  return (
    <section aria-label={title} data-testid={`remote-host-${id}`} style={{ border: "1px solid #94a3b8", borderRadius: 8, padding: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span data-testid={`remote-status-${id}`}>{status}</span>
      </header>
      <div ref={hostRef} data-testid={`remote-root-${id}`} />
    </section>
  );
}
