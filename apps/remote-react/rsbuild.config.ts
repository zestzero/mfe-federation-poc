import { createRemoteRsbuildConfig } from "@poc/remote-kit/rsbuild";
import mfConfig from "./module-federation.config.js";

export default createRemoteRsbuildConfig({
  port: 5001,
  title: "Fictional React Orders Remote",
  entry: "./src/bootstrap.tsx",
  mf: mfConfig,
});
