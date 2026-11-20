# AGENTS.md — Session Coordination MFE POC

## Ownership boundaries

- **Shell (per browser instance):** owns exactly one session coordinator, remote registry, transition orchestration, and the debug UI.
- **Remotes:** own QueryClient / ApolloClient, domain caches, and local feature state.
- **`@poc/platform-contracts`:** types + small validators only. No store instances.
- **`@poc/remote-kit`:** remote-side helpers (session resolve, mount handle, Rsbuild/MF factories, framework session hooks). Remotes may import it. Shells must not.
- **`@poc/session-coordinator`:** shell-internal. Remotes must not import it.
- **`@poc/shell-host`:** shell-internal (same rule as the coordinator). Catalog, MF/Modern.js config factories, and coordinator bootstrap. Remotes must not import it.
- **`@poc/shared-session-store`:** DI **C** demo only (anti-pattern).

## Session lifecycle rules

1. Enter `transitioning` and advance `contextRevision` before remote cleanup.
2. Call `prepareTransition` then `resetIdentityState` on registered remotes.
3. Confirm new fictional context with mock-api.
4. Publish snapshot; `resume` eligible remotes.
5. Cleanup failure → fail closed (`block`); do not resume with old data.
6. Competing commands: single-flight; superseded commands reject with `TRANSITION_SUPERSEDED`.
7. In-flight mutations may finish under the old revision; never auto-retry under a new account.

Read/subscribe alone is **not** proof that cleanup completed.

## Query / cache responsibilities

- Keep domain data in remote-owned caches.
- Use account + `contextRevision` in query identity.
- Drop obsolete responses after revision changes.
- Vue remote recreates Apollo Client + cache on identity reset (`clearStore` alone is insufficient).

## Adding a remote without shell coupling

1. Export `mount(element, capabilities): MountHandle` via Module Federation.
2. Resolve session with `@poc/remote-kit` `resolveSession(capabilities, label)`.
3. Return `createMountHandle(capabilities, hooks)` so dispose is idempotent and `forceCleanupFail` is handled once. Keep QueryClient / Apollo in the remote.
4. Depend on `@poc/platform-contracts` and `@poc/remote-kit` only (plus UI/data libraries the remote owns).
5. Use `createRemoteMfConfig` / `createRemoteRsbuildConfig` from `@poc/remote-kit/mf` and `@poc/remote-kit/rsbuild`. Subscribe to session with `@poc/remote-kit/react` or `@poc/remote-kit/vue`.
6. Add a catalog entry in `@poc/shell-host` (`id`, `mfName`, `manifestUrl`, `title`, `route`, optional `nav`).
7. In each consuming shell: pass that spec to `createShellMfConfig({ remotes })` and `bindMount(spec, () => import("<mfName>/mount"))` on `ShellApp` `remotes`. The `import()` must stay in the shell app so Module Federation rewrites it.
8. Mount through `@poc/shell-ui` `RemoteHost` (rendered from the `remotes` list). Do not add a `RemoteSlotId` union member or chrome nav by hand — nav and toggles come from the catalog.

Do **not** import shell internals, expose raw Zustand stores/`setState`, tokens, or query clients, or log credentials.

## Commands

```bash
pnpm install
pnpm dev:poc          # mock-api + remotes + shell-injected (A)
pnpm dev:a | dev:b | dev:c
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:e2e
```

Ports: mock-api `4010`, remote-react `5001`, remote-vue `5002`, shells `8090/8091/8092`.

## Testing expectations

- Unit: snapshot identity, subscribe/unsubscribe, single coordinator instance, transition sequencing, competing commands, timeouts, revision rejection.
- Playwright (shell A full matrix; B/C smoke): deterministic mock-api `__controls`, page objects, health gates before browser tests.
