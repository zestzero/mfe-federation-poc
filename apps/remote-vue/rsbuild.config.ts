import { pluginVue } from "@rsbuild/plugin-vue";
import { createRemoteRsbuildConfig } from "@poc/remote-kit/rsbuild";
import mfConfig from "./module-federation.config.js";

export default createRemoteRsbuildConfig({
  port: 5002,
  title: "Fictional Vue Account Summary Remote",
  entry: "./src/bootstrap.ts",
  mf: mfConfig,
  plugins: [pluginVue()],
});
