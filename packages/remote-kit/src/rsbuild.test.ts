import { describe, expect, it } from "vitest";
import { createRemoteMfConfig } from "./mf";
import { createRemoteRsbuildConfig } from "./rsbuild";

describe("createRemoteRsbuildConfig", () => {
  it("binds 127.0.0.1, the given port, and the standalone entry", async () => {
    const config = await createRemoteRsbuildConfig({
      port: 5001,
      title: "Fictional React Orders Remote",
      entry: "./src/bootstrap.tsx",
      mf: createRemoteMfConfig({ name: "reactRemote", expose: "./src/mount.tsx" }),
    });
    if (typeof config === "function") throw new Error("expected a resolved rsbuild config");
    expect(config.server).toMatchObject({ host: "127.0.0.1", port: 5001 });
    expect(config.source).toMatchObject({ entry: { index: "./src/bootstrap.tsx" } });
    expect(config.html).toMatchObject({ title: "Fictional React Orders Remote" });
    expect(config.plugins).toHaveLength(1);
  });
});
