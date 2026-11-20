import { createApp, h, shallowRef } from "vue";
import type { RemoteBlockReason, RemoteMount } from "@poc/platform-contracts";
import { createMountHandle, resolveSession } from "@poc/remote-kit";
import { createApolloClient } from "./apollo.js";
import App from "./App.vue";

function stopClient(client: { stop?: () => void }): void {
  // Apollo stop() can leave observers hanging; never block transitions on it.
  try {
    client.stop?.();
  } catch {
    // ignore
  }
}

export const mount: RemoteMount = (element, capabilities) => {
  const session = resolveSession(capabilities, "Vue remote");
  const snapshot = () => session.getSnapshot();
  const makeClient = () =>
    createApolloClient(() => {
      const current = snapshot();
      return {
        "x-poc-session": current.subjectId ?? "",
        "x-poc-account": current.accountId ?? "",
      };
    });
  const client = shallowRef(makeClient());
  const blocked = shallowRef<RemoteBlockReason | null>(null);
  const draftNote = shallowRef("");
  const app = createApp({
    setup: () => () =>
      h(App, {
        session,
        client: client.value,
        blocked: blocked.value,
        draftNote: draftNote.value,
        "onUpdate:draftNote": (value: string) => {
          draftNote.value = value;
        },
      }),
  });
  app.mount(element);

  return createMountHandle(capabilities, {
    async prepareTransition() {
      stopClient(client.value);
    },
    async resetIdentityState() {
      const oldClient = client.value;
      draftNote.value = "";
      client.value = makeClient();
      stopClient(oldClient);
    },
    async resume() {
      blocked.value = null;
    },
    block(reason) {
      blocked.value = reason;
      draftNote.value = "";
      stopClient(client.value);
    },
    dispose() {
      stopClient(client.value);
      app.unmount();
    },
  });
};

export default mount;
