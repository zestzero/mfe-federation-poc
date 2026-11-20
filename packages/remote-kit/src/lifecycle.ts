import type {
  MountCapabilities,
  MountHandle,
  RemoteBlockReason,
  RemoteLifecycle,
  TransitionContext,
} from "@poc/platform-contracts";

export type RemoteRuntimeHooks = {
  prepareTransition(ctx: TransitionContext): Promise<void>;
  resetIdentityState(ctx: TransitionContext): Promise<void>;
  resume(ctx: TransitionContext): Promise<void>;
  block(reason: RemoteBlockReason): void;
  dispose(): void;
};

export function createMountHandle(
  capabilities: MountCapabilities,
  hooks: RemoteRuntimeHooks,
): MountHandle {
  let disposed = false;
  const lifecycle: RemoteLifecycle = {
    async prepareTransition(ctx) {
      ctx.signal.throwIfAborted();
      await hooks.prepareTransition(ctx);
    },
    async resetIdentityState(ctx) {
      ctx.signal.throwIfAborted();
      if (capabilities.forceCleanupFail) throw new Error("forced cleanup failure");
      await hooks.resetIdentityState(ctx);
    },
    async resume(ctx) {
      ctx.signal.throwIfAborted();
      await hooks.resume(ctx);
    },
    block(reason) {
      hooks.block(reason);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      hooks.dispose();
    },
  };
  return { lifecycle, unmount: () => lifecycle.dispose() };
}
