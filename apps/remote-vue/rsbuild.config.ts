import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { pluginVue } from "@rsbuild/plugin-vue";
import { defineConfig } from "@rsbuild/core";
import tailwindcss from "@tailwindcss/postcss";
import mfConfig from "./module-federation.config.js";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5002 },
  plugins: [pluginVue(), pluginModuleFederation(mfConfig)],
  source: { entry: { index: "./src/bootstrap.ts" } },
  tools: {
    postcss: (_, { addPlugins }) => {
      addPlugins(tailwindcss());
    },
  },
  html: { title: "Fictional Vue Account Summary Remote" },
});
