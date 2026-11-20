import { STANDARD_SHELL_REMOTES, createShellMfConfig } from "@poc/shell-host/mf";

export default createShellMfConfig({
  name: "shell_injected",
  remotes: STANDARD_SHELL_REMOTES,
});
