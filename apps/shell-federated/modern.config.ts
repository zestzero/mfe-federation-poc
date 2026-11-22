import { appTools, defineConfig } from "@modern-js/app-tools";
import { moduleFederationPlugin } from "@module-federation/modern-js-v3";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  server: { port: 8091 },
  source: { enableAsyncEntry: true },
  tools: {
    postcss: (_, { addPlugins }) => {
      addPlugins(tailwindcss());
    },
  },
  plugins: [appTools(), moduleFederationPlugin()],
});
