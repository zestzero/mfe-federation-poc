import type { ModuleFederationOptions } from "@module-federation/rsbuild-plugin";

export const REACT_REMOTE_SHARED: NonNullable<ModuleFederationOptions["shared"]> = {
  react: {
    singleton: true,
    requiredVersion: "^19.0.0",
    eager: false,
    import: "react",
  },
  "react-dom": {
    singleton: true,
    requiredVersion: "^19.0.0",
    eager: false,
    import: "react-dom",
  },
};

export const VUE_REMOTE_SHARED: NonNullable<ModuleFederationOptions["shared"]> = {
  vue: { singleton: true, requiredVersion: "^3.5.0" },
};

export function createRemoteMfConfig(options: {
  name: string;
  expose: string;
  shared?: ModuleFederationOptions["shared"];
}): ModuleFederationOptions {
  return {
    name: options.name,
    filename: "remoteEntry.js",
    exposes: { "./mount": options.expose },
    ...(options.shared ? { shared: options.shared } : {}),
  };
}
