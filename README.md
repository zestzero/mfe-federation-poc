# Session Coordination MFE POC

Framework-agnostic session coordination across Module Federation remotes.

**Not production authentication.** All users/accounts/orders are fictional.

## What this proves

1. Remotes receive the same shell-owned `SessionApi`.
2. Public contract has no Modern.js / React / Zustand dependency.
3. Late-mounted remotes see the current session.
4. Account changes / logout do not show obsolete-context data.
5. TanStack Query and Apollo stay remote-owned.
6. Unmount/remount does not leak subscriptions.
7. A shell-owned `ShellApi` (navigation, language, user, layout, slots) is shared with remotes and fails closed with the session.

Packages: `@poc/platform-contracts` (types), `@poc/session-coordinator` and `@poc/shell-state` (shell-internal; remotes must not import them), `@poc/shell-ui` (shell chrome, `RemoteHost`).

Three DI shells:

| Command | Port | Style |
| --- | --- | --- |
| `pnpm dev:a` / `pnpm dev:poc` | **8090** | **A** shell-injected (baseline) |
| `pnpm dev:b` | **8091** | **B** federated `getSessionApi` |
| `pnpm dev:c` | **8092** | **C** shared Zustand package (anti-pattern) |

Ports `8080–8082` are avoided because some developer machines bind local proxies (e.g. gvproxy) on `8080`, which breaks Modern.js asset URLs when the framework falls back to another port.

## Setup

```bash
pnpm install
pnpm dev:poc
```

Requires Node >= 22.18 and pnpm 10.

Other ports: mock-api `4010`, remote-react `5001`, remote-vue `5002`.

## Commands

```bash
pnpm typecheck
pnpm test:unit
pnpm build
SHELL_A_URL=http://localhost:8090 pnpm test:e2e
```

## Simulated pieces

- Login/logout/account switch via mock-api `/api/session/*`
- REST orders + GraphQL account summary
- Deterministic `__controls` for delay / fail-next / cleanup-fail
- No real credentials or production services

## Reproduce scenarios (UI)

1. Cold start → status becomes `anonymous`.
2. Login → both remotes show North context / same revision.
3. Unmount Vue → remount → still current context.
4. Delay REST orders → switch to South → no North data under South.
5. Logout → login → no previous-user residue.
6. Unmount/remount React → event log shows mount lifecycle; no duplicate live subs.
7. Enable “Force remote cleanup failure” → switch account → affected remote stays paused.
8. Delayed work during transition → completes under old revision policy; no auto-retry.
9. Fail-next on `/api/session/account` → error shown; safe recoverable state.

Shell API scenarios (Playwright shell A, scenarios 10-19):

10. Language set in the shell reaches both remotes without a session revision change.
11. Language set by a remote reaches the shell and the other remote.
12. Remote `navigate` updates the shell path; remote layout (title, breadcrumbs, actions) renders in the shell.
13. Shell nav drives the remote view and the active remote's layout.
14. Remote content renders in the `header` and `sidebar` slots.
15. During an account switch slots hold no old-account text and `path` is truncated to its route root.
16. Forced cleanup failure fails closed: slot content is removed.
17. Unmounting a remote removes its layout and slots.
18. A 60-character order id (deep link and in-session) still yields a valid layout; the remote mounts and registers.
19. Browser Back after an account switch does not restore the previous account's order id.

## Test results (executed 2026-11-16)

| Suite | Result | Notes |
| --- | --- | --- |
| Unit (`platform-contracts`, `session-coordinator`, `shell-state`, `shared-session-store`) | **86 passed** | vitest (17 + 12 + 56 + 1) |
| Playwright shell A (scenarios 1–19) | **19 passed** | `SHELL_A_URL=http://localhost:8090` |
| Playwright B/C smoke | **2 passed** | `SHELL_B_URL=http://localhost:8091`, `SHELL_C_URL=http://localhost:8092` (21 total, 0 skipped) |
| Typecheck (shells, remotes, shell-ui) | **pass** | MF config files excluded from tsc where SDK types are non-portable |

## Docs

- [Architecture](docs/architecture.md)
- [Decision: session DI](docs/decisions/001-session-di.md)
- [Measurement plan](docs/measurement-plan.md)
- [Limitations](docs/limitations.md)
- [AGENTS.md](AGENTS.md)

## Suggested next pilot step

Adopt DI **A** in one real shell with a single remote; keep query clients remote-owned; replace mock-api with your IdP behind the same `SessionApi` commands; add SSR request-scoped session only if required.
