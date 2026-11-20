import { useMemo } from "react";
import { REACT_REMOTE, VUE_REMOTE, bindMount, injectedCapabilities } from "@poc/shell-host";
import { asSessionApi, getSharedSessionStore } from "@poc/shared-session-store";
import { ShellApp } from "@poc/shell-ui";

const remotes = [
  bindMount(REACT_REMOTE, () => import("reactRemote/mount")),
  bindMount(VUE_REMOTE, () => import("vueRemote/mount")),
];

export default function App() {
  const { api, registry } = useMemo(() => {
    const store = getSharedSessionStore();
    return { api: asSessionApi(store), registry: store.registry };
  }, []);

  return (
    <ShellApp
      diMode="C"
      title="Shell Zustand — DI C (shared Zustand package anti-pattern)"
      banner="DI C anti-pattern: shared Zustand package. Remotes/shells can import the same package-level singleton — instance identity is not shell-injected."
      session={api}
      registry={registry}
      remotes={remotes}
      resolveRemoteCapabilities={injectedCapabilities(api)}
    />
  );
}
