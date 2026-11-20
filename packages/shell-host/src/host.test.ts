import { describe, expect, it, vi } from "vitest";
import { SESSION_CONTRACT_VERSION, type SessionApi } from "@poc/platform-contracts";
import { createCoordinatorHost, injectedCapabilities, resolverCapabilities } from "./host";

const fakeSession = {
  contractVersion: SESSION_CONTRACT_VERSION,
  getSnapshot: () => ({ status: "anonymous", contextRevision: 1 }),
} as SessionApi;

describe("createCoordinatorHost", () => {
  it("returns a session api and remote registry", () => {
    const host = createCoordinatorHost();
    expect(host.api.getSnapshot()).toEqual({ status: "initializing", contextRevision: 0 });
    expect(host.registry).toEqual(
      expect.objectContaining({ register: expect.any(Function), unregister: expect.any(Function) }),
    );
    host.dispose();
  });
});

describe("capability helpers", () => {
  const onEvent = vi.fn();

  it("injectedCapabilities passes the live session", () => {
    const resolve = injectedCapabilities(fakeSession);
    expect(resolve({ forceCleanupFail: true, onEvent })).toEqual({
      session: fakeSession,
      forceCleanupFail: true,
      onEvent,
    });
  });

  it("resolverCapabilities passes a session accessor", () => {
    const resolveSession = () => fakeSession;
    const resolve = resolverCapabilities(resolveSession);
    expect(resolve({ forceCleanupFail: false, onEvent })).toEqual({
      resolveSession,
      forceCleanupFail: false,
      onEvent,
    });
  });
});
