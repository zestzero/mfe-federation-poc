import { createModuleFederationConfig } from "@module-federation/modern-js-v3";
import type { ShellRemoteSpec } from "./remotes";

export {
  EVENTS_REMOTE,
  EVENTS_SHELL_REMOTES,
  REACT_REMOTE,
  STANDARD_SHELL_REMOTES,
  VUE_REMOTE,
} from "./remotes";

const SHELL_SHARED_REACT = {
  react: { singleton: true, requiredVersion: "^19.0.0", eager: true },
  "react-dom": { singleton: true, requiredVersion: "^19.0.0", eager: true },
};

export type ShellMfConfig = {
  name: string;
  remotes: Record<string, string>;
  shared: typeof SHELL_SHARED_REACT;
  exposes?: Record<string, string>;
};

export function createShellMfConfig(options: {
  name: string;
  remotes: readonly ShellRemoteSpec[];
  exposes?: Record<string, string>;
}): ShellMfConfig {
  return createModuleFederationConfig({
    name: options.name,
    ...(options.exposes ? { exposes: options.exposes } : {}),
    remotes: Object.fromEntries(
      options.remotes.map((remote) => [remote.mfName, `${remote.mfName}@${remote.manifestUrl}`]),
    ),
    shared: SHELL_SHARED_REACT,
  }) as ShellMfConfig;
}
