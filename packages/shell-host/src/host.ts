import type { SessionApi } from "@poc/platform-contracts";
import { createSessionCoordinator } from "@poc/session-coordinator";
import { createMockAuthBridge } from "./createMockAuthBridge";

export type RemoteCapabilityInput = {
  forceCleanupFail: boolean;
  onEvent: (event: { type: string; detail?: unknown }) => void;
};

export function createCoordinatorHost(initialSubjectId = "user_ava") {
  return createSessionCoordinator({
    auth: createMockAuthBridge(initialSubjectId),
  });
}

export function injectedCapabilities(session: SessionApi) {
  return ({ forceCleanupFail, onEvent }: RemoteCapabilityInput) => ({
    session,
    forceCleanupFail,
    onEvent,
  });
}

export function resolverCapabilities(resolveSession: () => SessionApi) {
  return ({ forceCleanupFail, onEvent }: RemoteCapabilityInput) => ({
    resolveSession,
    forceCleanupFail,
    onEvent,
  });
}
