import "./styles.css";
import { useMemo } from "react";
import { createSessionCoordinator } from "@poc/session-coordinator";
import { ShellApp, createMockAuthBridge } from "@poc/shell-ui";
import { getSessionApi, setHostSessionApi } from "./sessionApi";

export default function App() {
  const { api, registry } = useMemo(() => {
    const coordinator = createSessionCoordinator({
      auth: createMockAuthBridge("user_ava"),
    });
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
      resolveRemoteCapabilities={({ forceCleanupFail, onEvent }) => ({
        resolveSession: () => getSessionApi(),
        forceCleanupFail,
        onEvent,
      })}
      loadReactMount={() => import("reactRemote/mount")}
      loadVueMount={() => import("vueRemote/mount")}
    />
  );
}
