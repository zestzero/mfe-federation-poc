import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import type { RemoteBlockReason, RemoteMount } from "@poc/platform-contracts";
import { createMountHandle, resolveSession } from "@poc/remote-kit";
import { App, type LocalFeatureState } from "./App.js";

void React;

export const mount: RemoteMount = (element, capabilities) => {
  const session = resolveSession(capabilities, "React remote");
  const queryClient = new QueryClient();
  let blocked: RemoteBlockReason | null = null;
  let localFeature: LocalFeatureState = { draftNote: "" };
  const root = createRoot(element);
  let live = true;
  const render = () => {
    if (!live) return;
    root.render(
      <QueryClientProvider client={queryClient}>
        <App
          session={session}
          blocked={blocked}
          localFeature={localFeature}
          setLocalFeature={(update) => {
            localFeature = typeof update === "function" ? update(localFeature) : update;
            render();
          }}
        />
      </QueryClientProvider>,
    );
  };
  const unsubscribe = session.subscribe(render);
  render();

  return createMountHandle(capabilities, {
    async prepareTransition() {
      void queryClient.cancelQueries();
    },
    async resetIdentityState() {
      void queryClient.cancelQueries();
      queryClient.clear();
      localFeature = { draftNote: "" };
    },
    async resume() {
      blocked = null;
      render();
    },
    block(reason) {
      blocked = reason;
      localFeature = { draftNote: "" };
      void queryClient.cancelQueries();
      queryClient.clear();
      render();
    },
    dispose() {
      live = false;
      unsubscribe();
      queryClient.clear();
      root.unmount();
    },
  });
};

export default mount;
