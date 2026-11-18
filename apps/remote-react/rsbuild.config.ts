import { defineConfig } from "@rsbuild/core";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import tailwindcss from "@tailwindcss/postcss";
import mfConfig from "./module-federation.config.js";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5001 },
  plugins: [pluginModuleFederation(mfConfig)],
  source: { entry: { index: "./src/bootstrap.tsx" } },
  tools: {
    // Design-system components are compiled from source and rely on the automatic JSX runtime.
    swc: { jsc: { transform: { react: { runtime: "automatic" } } } },
    postcss: (_, { addPlugins }) => {
      addPlugins(tailwindcss());
    },
  },
  html: { title: "Fictional React Orders Remote" },
});
