import "./styles.css";
import { useMemo } from "react";
import { createSessionCoordinator } from "@poc/session-coordinator";
import { ShellApp, createMockAuthBridge } from "@poc/shell-ui";

export default function App() {
  const { api, registry } = useMemo(
    () =>
      createSessionCoordinator({
        auth: createMockAuthBridge("user_ava"),
      }),
    [],
  );

  return (
    <ShellApp
      diMode="A"
      title="Shell Injected — DI A (session capability via mount)"
      session={api}
      registry={registry}
      resolveRemoteCapabilities={({ forceCleanupFail, onEvent }) => ({
        session: api,
        forceCleanupFail,
        onEvent,
      })}
      loadReactMount={() => import("reactRemote/mount")}
      loadVueMount={() => import("vueRemote/mount")}
    />
  );
}
