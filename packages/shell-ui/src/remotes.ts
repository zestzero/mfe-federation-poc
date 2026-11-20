export type RemoteNavSpec = { id: string; label: string };

export function routesFromRemotes(remotes: readonly { route: string; id: string }[]): Record<string, string> {
  return Object.fromEntries(remotes.map((remote) => [remote.route, remote.id]));
}

export function navFromRemotes(
  remotes: readonly { id: string; route: string; nav?: RemoteNavSpec }[],
): { id: string; label: string; path: string; remoteId: string }[] {
  return remotes.flatMap((remote) =>
    remote.nav
      ? [{ id: remote.nav.id, label: remote.nav.label, path: remote.route, remoteId: remote.id }]
      : [],
  );
}
