import { useCallback, useSyncExternalStore } from "react";
import type { ShellApi, ShellCommandError, ShellState } from "@poc/platform-contracts";

const none = () => null;

/** Shell state via useSyncExternalStore; null when the shell capability is absent. */
export function useShellState(shell: ShellApi | undefined): Readonly<ShellState> | null {
  const subscribe = useCallback(
    (onChange: () => void) => (shell ? shell.subscribe(onChange) : () => {}),
    [shell],
  );
  return useSyncExternalStore(
    subscribe,
    shell ? () => shell.getState() : none,
    shell ? () => shell.getState() : none,
  );
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

/** `/orders/<id>` -> id, otherwise null. */
export function orderIdFromPath(path: string | undefined): string | null {
  return path?.match(/^\/orders\/([^/]+)$/)?.[1] ?? null;
}

/** Mirrors the contract's 40-character label limit (validateLayoutSpec); truncates with an ellipsis. */
export function clampLabel(label: string, max = 40): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
