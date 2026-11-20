import { useMemo } from "react";
import {
  REACT_REMOTE,
  VUE_REMOTE,
  bindMount,
  createCoordinatorHost,
  injectedCapabilities,
} from "@poc/shell-host";
import { ShellApp } from "@poc/shell-ui";

const remotes = [
  bindMount(REACT_REMOTE, () => import("reactRemote/mount")),
  bindMount(VUE_REMOTE, () => import("vueRemote/mount")),
];

export default function App() {
  const { api, registry } = useMemo(() => createCoordinatorHost(), []);

  return (
    <ShellApp
      diMode="A"
      title="Shell Injected — DI A (session capability via mount)"
      session={api}
      registry={registry}
      remotes={remotes}
      resolveRemoteCapabilities={injectedCapabilities(api)}
    />
  );
}
