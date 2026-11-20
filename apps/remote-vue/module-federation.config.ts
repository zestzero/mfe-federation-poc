import { VUE_REMOTE_SHARED, createRemoteMfConfig } from "@poc/remote-kit/mf";

export default createRemoteMfConfig({
  name: "vueRemote",
  expose: "./src/mount.ts",
  shared: VUE_REMOTE_SHARED,
});
