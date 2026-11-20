import type { RemoteMount } from "@poc/platform-contracts";

export type RemoteLoader = () => Promise<{ default?: RemoteMount; mount?: RemoteMount }>;

export type ShellRemoteSpec = {
  id: string;
  mfName: string;
  manifestUrl: string;
  title: string;
  route: `/${string}`;
  nav?: { id: string; label: string };
};

export type BoundRemote = ShellRemoteSpec & { load: RemoteLoader };

export const REACT_REMOTE = {
  id: "react",
  mfName: "reactRemote",
  manifestUrl: "http://localhost:5001/mf-manifest.json",
  title: "React + TanStack Query (fictional orders)",
  route: "/orders",
  nav: { id: "orders", label: "Orders" },
} as const satisfies ShellRemoteSpec;

export const VUE_REMOTE = {
  id: "vue",
  mfName: "vueRemote",
  manifestUrl: "http://localhost:5002/mf-manifest.json",
  title: "Vue + Apollo (fictional summary)",
  route: "/summary",
  nav: { id: "summary", label: "Summary" },
} as const satisfies ShellRemoteSpec;

export const EVENTS_REMOTE = {
  id: "events",
  mfName: "eventsRemote",
  manifestUrl: "http://localhost:5003/mf-manifest.json",
  title: "Signals remote (events)",
  route: "/events",
  nav: { id: "events", label: "Events" },
} as const satisfies ShellRemoteSpec;

export const STANDARD_SHELL_REMOTES = [REACT_REMOTE, VUE_REMOTE] as const;
export const EVENTS_SHELL_REMOTES = [REACT_REMOTE, VUE_REMOTE, EVENTS_REMOTE] as const;

export function bindMount<S extends ShellRemoteSpec>(spec: S, load: RemoteLoader): S & { load: RemoteLoader } {
  return { ...spec, load };
}
