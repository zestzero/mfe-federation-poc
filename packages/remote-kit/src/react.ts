import { useSyncExternalStore } from "react";
import type { SessionApi, SessionSnapshot } from "@poc/platform-contracts";

export function useSessionSnapshot(session: SessionApi): Readonly<SessionSnapshot> {
  return useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
}
