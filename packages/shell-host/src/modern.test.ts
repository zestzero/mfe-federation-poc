import { describe, expect, it } from "vitest";
import { createShellModernConfig } from "./modern";

describe("createShellModernConfig", () => {
  it("sets the host port and enables async entry for Module Federation", async () => {
    const config = await createShellModernConfig({ port: 8090 });
    if (typeof config === "function" || !("plugins" in config) || !Array.isArray(config.plugins)) {
      throw new Error("expected a resolved user config object");
    }
    expect(config).toMatchObject({
      server: { port: 8090 },
      source: { enableAsyncEntry: true },
    });
    expect(config.plugins).toHaveLength(2);
  });
});
