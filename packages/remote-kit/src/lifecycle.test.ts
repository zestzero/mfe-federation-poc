import { describe, expect, it, vi } from "vitest";
import type { TransitionContext } from "@poc/platform-contracts";
import { createMountHandle } from "./lifecycle";

function ctx(signal = new AbortController().signal): TransitionContext {
  return { fromRevision: 0, toRevision: 1, signal };
}

function hooks() {
  return {
    prepareTransition: vi.fn(async () => {}),
    resetIdentityState: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    block: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("createMountHandle", () => {
  it("forwards lifecycle calls and maps unmount to dispose", async () => {
    const h = hooks();
    const handle = createMountHandle({}, h);
    const transition = ctx();
    await handle.lifecycle.prepareTransition(transition);
    await handle.lifecycle.resetIdentityState(transition);
    await handle.lifecycle.resume(transition);
    handle.lifecycle.block({ type: "timeout", message: "timed out" });
    expect(h.prepareTransition).toHaveBeenCalledWith(transition);
    expect(h.resetIdentityState).toHaveBeenCalledWith(transition);
    expect(h.resume).toHaveBeenCalledWith(transition);
    expect(h.block).toHaveBeenCalledWith({ type: "timeout", message: "timed out" });
    handle.unmount();
    expect(h.dispose).toHaveBeenCalledTimes(1);
    handle.lifecycle.dispose();
    expect(h.dispose).toHaveBeenCalledTimes(1);
  });

  it("throws forced cleanup failure before the remote reset hook", async () => {
    const h = hooks();
    const handle = createMountHandle({ forceCleanupFail: true }, h);
    await expect(handle.lifecycle.resetIdentityState(ctx())).rejects.toThrow("forced cleanup failure");
    expect(h.resetIdentityState).not.toHaveBeenCalled();
  });

  it("aborts async lifecycle when the transition signal is aborted", async () => {
    const h = hooks();
    const handle = createMountHandle({}, h);
    const controller = new AbortController();
    controller.abort();
    await expect(handle.lifecycle.prepareTransition(ctx(controller.signal))).rejects.toThrow();
    expect(h.prepareTransition).not.toHaveBeenCalled();
  });
});
