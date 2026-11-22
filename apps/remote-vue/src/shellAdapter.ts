import { onScopeDispose, readonly, shallowRef } from "vue";
import type { ShellApi, ShellCommandError, ShellState } from "@poc/platform-contracts";

/** Shell state as a readonly shallowRef; null when the shell capability is absent. One subscription per scope. */
export function useShellState(shell: ShellApi | undefined) {
  const state = shallowRef<Readonly<ShellState> | null>(shell ? shell.getState() : null);
  if (shell) {
    const unsubscribe = shell.subscribe(() => {
      state.value = shell.getState();
    });
    onScopeDispose(unsubscribe);
  }
  return readonly(state);
}

/**
 * Runs a shell command, ignoring only the expected refusals: FACADE_REVOKED (remote was blocked or
 * unmounted) and SLOT_TAKEN (another remote holds the slot). Anything else, INVALID_* included, is a bug and rethrows.
 */
export function tryShell<T>(command: () => T): T | undefined {
  try {
    return command();
  } catch (error) {
    const code = isShellCommandError(error) ? error.code : undefined;
    if (code === "FACADE_REVOKED" || code === "SLOT_TAKEN") return undefined;
    throw error;
  }
}

/**
 * Structural check, not `instanceof`: @poc/platform-contracts is not in the federation shared scope,
 * so the shell's ShellCommandError class is a different copy from the one bundled in this remote.
 */
function isShellCommandError(error: unknown): error is ShellCommandError {
  return error instanceof Error && error.name === "ShellCommandError" && typeof (error as { code?: unknown }).code === "string";
}
