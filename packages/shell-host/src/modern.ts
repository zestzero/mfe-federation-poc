import { appTools, defineConfig } from "@modern-js/app-tools";
import { moduleFederationPlugin } from "@module-federation/modern-js-v3";

/** Host ports start at 8090 to avoid local proxies on 8080 (e.g. gvproxy). */
export function createShellModernConfig(options: { port: number }) {
  return defineConfig({
    server: { port: options.port },
    source: { enableAsyncEntry: true },
    plugins: [appTools(), moduleFederationPlugin()],
  });
}
