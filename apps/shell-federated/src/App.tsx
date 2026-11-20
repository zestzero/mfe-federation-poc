import { useMemo } from "react";
import {
  REACT_REMOTE,
  VUE_REMOTE,
  bindMount,
  createCoordinatorHost,
  resolverCapabilities,
} from "@poc/shell-host";
import { ShellApp } from "@poc/shell-ui";
import { getSessionApi, setHostSessionApi } from "./sessionApi";

const remotes = [
  bindMount(REACT_REMOTE, () => import("reactRemote/mount")),
  bindMount(VUE_REMOTE, () => import("vueRemote/mount")),
];

export default function App() {
  const { api, registry } = useMemo(() => {
    const coordinator = createCoordinatorHost();
    setHostSessionApi(coordinator.api);
    return coordinator;
  }, []);

  return (
    <ShellApp
      diMode="B"
      title="Shell Federated — DI B (federated getSessionApi accessor)"
      banner="DI B: remotes receive resolveSession={() => getSessionApi()}. The host also exposes ./session via Module Federation for comparison."
      session={api}
      registry={registry}
      remotes={remotes}
      resolveRemoteCapabilities={resolverCapabilities(() => getSessionApi())}
    />
  );
}
