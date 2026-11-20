import { describe, expect, it } from "vitest";
import { EVENTS_SHELL_REMOTES, STANDARD_SHELL_REMOTES } from "./remotes";
import { createShellMfConfig } from "./mf";

describe("createShellMfConfig", () => {
  it("maps catalog remotes to MF manifest URLs and shares React eagerly", () => {
    const config = createShellMfConfig({
      name: "shell_injected",
      remotes: STANDARD_SHELL_REMOTES,
    });
    expect(config.name).toBe("shell_injected");
    expect(config.remotes).toEqual({
      reactRemote: "reactRemote@http://localhost:5001/mf-manifest.json",
      vueRemote: "vueRemote@http://localhost:5002/mf-manifest.json",
    });
    expect(config.shared).toEqual({
      react: { singleton: true, requiredVersion: "^19.0.0", eager: true },
      "react-dom": { singleton: true, requiredVersion: "^19.0.0", eager: true },
    });
  });

  it("passes through exposes and extra catalog remotes", () => {
    const config = createShellMfConfig({
      name: "shell_federated",
      remotes: EVENTS_SHELL_REMOTES,
      exposes: { "./session": "./src/sessionApi.ts" },
    });
    expect(config.exposes).toEqual({ "./session": "./src/sessionApi.ts" });
    expect(config.remotes).toEqual({
      reactRemote: "reactRemote@http://localhost:5001/mf-manifest.json",
      vueRemote: "vueRemote@http://localhost:5002/mf-manifest.json",
      eventsRemote: "eventsRemote@http://localhost:5003/mf-manifest.json",
    });
  });
});
