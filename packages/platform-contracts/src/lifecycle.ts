import type { SessionApi } from "./session";
import type { ShellApi } from "./shell";

export type TransitionContext = {
  fromRevision: number;
  toRevision: number;
  signal: AbortSignal;
};

export type RemoteBlockReason =
  | { type: "cleanup_failed"; message: string }
  | { type: "timeout"; message: string }
  | { type: "transition_failed"; message: string };

export interface RemoteLifecycle {
  prepareTransition(ctx: TransitionContext): Promise<void>;
  resetIdentityState(ctx: TransitionContext): Promise<void>;
  resume(ctx: TransitionContext): Promise<void>;
  block(reason: RemoteBlockReason): void;
  dispose(): void;
}

export interface MountHandle {
  lifecycle: RemoteLifecycle;
  unmount(): void;
}

export type MountCapabilities = {
  session?: SessionApi;
  resolveSession?: () => SessionApi;
  shell?: ShellApi;
  forceCleanupFail?: boolean;
  /** Optional diagnostics sink from shell */
  onEvent?: (event: { type: string; detail?: unknown }) => void;
};

export type RemoteMount = (
  element: HTMLElement,
  capabilities: MountCapabilities,
) => MountHandle;
