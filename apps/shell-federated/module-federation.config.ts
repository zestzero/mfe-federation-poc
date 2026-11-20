import { STANDARD_SHELL_REMOTES, createShellMfConfig } from "@poc/shell-host/mf";

export default createShellMfConfig({
  name: "shell_federated",
  remotes: STANDARD_SHELL_REMOTES,
  exposes: {
    "./session": "./src/sessionApi.ts",
  },
});
