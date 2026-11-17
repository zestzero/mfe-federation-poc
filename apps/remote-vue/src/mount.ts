import { createApp, h, shallowRef } from "vue";
import type { MountCapabilities, MountHandle, RemoteBlockReason, RemoteMount, SessionApi } from "@poc/platform-contracts";
import { createApolloClient } from "./apollo.js";
import App from "./App.vue";
import SidebarCard from "./SidebarCard.vue";
import { tryShell } from "./shellAdapter.js";
import { t } from "./i18n.js";

function resolveSession(capabilities: MountCapabilities): SessionApi {
  const session = capabilities.session ?? capabilities.resolveSession?.();
  if (!session) throw new Error("Vue remote requires a session capability or resolver");
  return session;
}

function stopClient(client: { stop?: () => void }): void {
  // Apollo stop() can leave observers hanging; never block transitions on it.
  try {
    client.stop?.();
  } catch {
    // ignore
  }
}

export const mount: RemoteMount = (element, capabilities): MountHandle => {
  const session = resolveSession(capabilities);
  const shell = capabilities.shell;
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
  let disposed = false;
  const app = createApp({
    setup: () => () =>
      h(App, {
        session,
        shell,
        client: client.value,
        blocked: blocked.value,
        draftNote: draftNote.value,
        "onUpdate:draftNote": (value: string) => {
          draftNote.value = value;
        },
      }),
  });
  app.mount(element);

  // Shell contributions. The shell drops layouts while transitioning and clears them on every transition,
  // so the layout is re-sent on any language or session change and forced in resume().
  let releaseLayout: (() => void) | undefined;
  let releaseSlot: (() => void) | undefined;
  let layoutKey = "";
  const syncLayout = (force = false) => {
    if (!shell || disposed || blocked.value) return;
    const { language } = shell.getState();
    const current = snapshot();
    const key = [language, current.status, current.accountId, current.contextRevision].join("|");
    if (!force && key === layoutKey) return; // setLayout notifies subscribers; the key stops the loop
    // Set before sending: setLayout notifies our own subscriber, which re-enters syncLayout. Reset on failure.
    layoutKey = key;
    try {
      releaseLayout?.();
      releaseLayout = tryShell(() =>
        shell.setLayout({ title: t(language, "Account summary"), breadcrumbs: [{ label: t(language, "Summary") }] }),
      );
    } catch (error) {
      layoutKey = ""; // retried on the next change
      throw error;
    }
  };
  /** Used from block/dispose: release functions only, and nothing may throw out of these lifecycle paths. */
  const releaseShell = () => {
    for (const release of [releaseLayout, releaseSlot]) {
      try {
        release?.();
      } catch (error) {
        console.warn("[remote-vue] shell release failed", error);
      }
    }
    releaseLayout = releaseSlot = undefined;
  };
  const unsubscribeSession = shell ? session.subscribe(() => syncLayout()) : undefined;
  const unsubscribeShell = shell?.subscribe(() => syncLayout());
  syncLayout();
  if (shell) {
    // SLOT_TAKEN (or a revoked facade) means we carry on without the sidebar slot.
    releaseSlot = tryShell(() =>
      shell.claimSlot("sidebar", (el) => {
        // Fresh app each call (the shell re-renders the slot after resume). client.value is read in the
        // render function, so the card always uses the current client, recreated on identity reset.
        const slotApp = createApp({ setup: () => () => h(SidebarCard, { session, shell, client: client.value }) });
        slotApp.mount(el);
        return () => slotApp.unmount();
      }),
    );
  }

  const lifecycle = {
    async prepareTransition(ctx: { signal: AbortSignal }): Promise<void> {
      ctx.signal.throwIfAborted();
      stopClient(client.value);
    },
    async resetIdentityState(ctx: { signal: AbortSignal }): Promise<void> {
      ctx.signal.throwIfAborted();
      if (capabilities.forceCleanupFail) throw new Error("forced cleanup failure");
      const oldClient = client.value;
      draftNote.value = "";
      client.value = makeClient();
      stopClient(oldClient);
    },
    async resume(ctx: { signal: AbortSignal }): Promise<void> {
      ctx.signal.throwIfAborted();
      blocked.value = null;
      syncLayout(true);
    },
    block(reason: RemoteBlockReason): void {
      blocked.value = reason;
      releaseShell();
      draftNote.value = "";
      stopClient(client.value);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribeSession?.();
      unsubscribeShell?.();
      releaseShell();
      stopClient(client.value);
      app.unmount();
    },
  };
  return { lifecycle, unmount: () => lifecycle.dispose() };
};

export default mount;
