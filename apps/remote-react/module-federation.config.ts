import { REACT_REMOTE_SHARED, createRemoteMfConfig } from "@poc/remote-kit/mf";

export default createRemoteMfConfig({
  name: "reactRemote",
  expose: "./src/mount.tsx",
  shared: REACT_REMOTE_SHARED,
});
