import { describe, expect, it } from "vitest";
import { SESSION_CONTRACT_VERSION, type SessionApi } from "@poc/platform-contracts";
import { resolveSession } from "./session";

const session = {
  contractVersion: SESSION_CONTRACT_VERSION,
  getSnapshot: () => ({ status: "anonymous", contextRevision: 0 }),
} as SessionApi;

describe("resolveSession", () => {
  it("uses capabilities.session when present", () => {
    expect(resolveSession({ session }, "React remote")).toBe(session);
  });

  it("falls back to resolveSession()", () => {
    expect(resolveSession({ resolveSession: () => session }, "Vue remote")).toBe(session);
  });

  it("prefers the injected session over the resolver", () => {
    const other = { ...session } as SessionApi;
    expect(resolveSession({ session, resolveSession: () => other }, "React remote")).toBe(session);
  });

  it("throws when neither session nor resolver is provided", () => {
    expect(() => resolveSession({}, "React remote")).toThrow(
      "React remote requires a session capability or resolver",
    );
  });
});
