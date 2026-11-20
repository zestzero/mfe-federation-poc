import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig, type RsbuildPlugin } from "@rsbuild/core";
import type { ModuleFederationOptions } from "@module-federation/rsbuild-plugin";

export function createRemoteRsbuildConfig(options: {
  port: number;
  title: string;
  entry: string;
  mf: ModuleFederationOptions;
  plugins?: RsbuildPlugin[];
}) {
  return defineConfig({
    server: { host: "127.0.0.1", port: options.port },
    plugins: [...(options.plugins ?? []), pluginModuleFederation(options.mf)],
    source: { entry: { index: options.entry } },
    html: { title: options.title },
  });
}
