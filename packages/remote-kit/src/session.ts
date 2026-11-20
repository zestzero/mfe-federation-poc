import type { MountCapabilities, SessionApi } from "@poc/platform-contracts";

export function resolveSession(capabilities: MountCapabilities, remoteLabel: string): SessionApi {
  const session = capabilities.session ?? capabilities.resolveSession?.();
  if (!session) throw new Error(`${remoteLabel} requires a session capability or resolver`);
  return session;
}
