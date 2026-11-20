import { describe, expect, it } from "vitest";
import { REACT_REMOTE_SHARED, VUE_REMOTE_SHARED, createRemoteMfConfig } from "./mf";

describe("createRemoteMfConfig", () => {
  it("exposes ./mount with remoteEntry.js", () => {
    const config = createRemoteMfConfig({
      name: "reactRemote",
      expose: "./src/mount.tsx",
      shared: REACT_REMOTE_SHARED,
    });
    expect(config).toMatchObject({
      name: "reactRemote",
      filename: "remoteEntry.js",
      exposes: { "./mount": "./src/mount.tsx" },
      shared: REACT_REMOTE_SHARED,
    });
  });

  it("omits shared when the remote bundles everything", () => {
    const config = createRemoteMfConfig({ name: "eventsRemote", expose: "./src/mount.ts" });
    expect(config.shared).toBeUndefined();
    expect(config.exposes).toEqual({ "./mount": "./src/mount.ts" });
  });

  it("shares Vue as a singleton for the Vue remote", () => {
    expect(VUE_REMOTE_SHARED).toEqual({
      vue: { singleton: true, requiredVersion: "^3.5.0" },
    });
  });
});
