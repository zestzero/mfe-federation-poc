import type { MountHandle, RemoteMount, SessionApi } from "@poc/platform-contracts";
import type { RemoteRegistry } from "@poc/session-coordinator";

export type DiMode = "A" | "B" | "C";

export type ShellEvent = {
  id: number;
  at: string;
  type: string;
  detail?: unknown;
};

export type RemoteSlotId = string;

export type RemoteLoader = () => Promise<{ default?: RemoteMount; mount?: RemoteMount }>;

export type RemoteDescriptor = {
  id: string;
  title: string;
  route: string;
  load: RemoteLoader;
  nav?: { id: string; label: string };
};

export type ShellUiProps = {
  diMode: DiMode;
  title: string;
  banner?: string;
  session: SessionApi;
  registry: RemoteRegistry;
  /** Resolve SessionApi for remotes — A passes session directly; B/C may pass resolveSession. */
  resolveRemoteCapabilities: (opts: {
    forceCleanupFail: boolean;
    onEvent: (event: { type: string; detail?: unknown }) => void;
  }) => {
    session?: SessionApi;
    resolveSession?: () => SessionApi;
    forceCleanupFail?: boolean;
    onEvent?: (event: { type: string; detail?: unknown }) => void;
  };
  remotes: RemoteDescriptor[];
};

export type MountedRemote = {
  id: RemoteSlotId;
  handle: MountHandle;
};
