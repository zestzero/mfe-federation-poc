import { onScopeDispose, readonly, shallowRef } from "vue";
import type { SessionApi, SessionSnapshot } from "@poc/platform-contracts";

export function useSessionSnapshot(session: SessionApi) {
  const snapshot = shallowRef<Readonly<SessionSnapshot>>(session.getSnapshot());
  const unsubscribe = session.subscribe(() => {
    snapshot.value = session.getSnapshot();
  });
  onScopeDispose(unsubscribe);
  return readonly(snapshot);
}
