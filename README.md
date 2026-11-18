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

Packages: `@poc/platform-contracts` (types), `@poc/session-coordinator` and `@poc/shell-state` (shell-internal; remotes must not import them), `@poc/shell-ui` (shell chrome, `RemoteHost`), `@poc/design-system` (Tailwind v4 theme, tokens, React components) and `@poc/design-system-vue` (Vue ports). The shell owns token values; remotes build their own CSS from the shared mapping. See [Design system](docs/design-system.md).

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
pnpm --filter <app> check:css              # after pnpm build: shell-injected, shell-federated, shell-zustand, remote-react, remote-vue
pnpm --filter @poc/shell-ui check:styles   # no inline styles in shell-ui
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

Design system scenarios (Playwright shell A, `a-design.spec.ts`; 21 is in `a-shell.spec.ts`):

20. Each remote's own CSS (shipped with `./mount`) reaches the page when the shell mounts it (per-remote discriminator classes).
21. A cold cross-document deep link keeps its order id.
22. The shell theme toggle switches `<html>` to dark.
23. Shell chrome keeps native controls.
24. Force-cleanup-fail is still a checkbox and shell panels follow the theme.
25. The React remote uses design-system tokens (same radius and font size as the shell button).
26. The Vue remote follows the shell theme and tokens; its language picker stays a controlled native select.
27. Theme survives an account switch (header and sidebar slots repaint with dark tokens).
28. Theme survives forced cleanup failure and remount.
29. Tokens agree across shell and remotes (radius, font family).

## Test results (executed 2026-11-17)

| Suite | Result | Notes |
| --- | --- | --- |
| Unit (`platform-contracts`, `design-system`, `session-coordinator`, `design-system-vue`, `shell-state`, `shell-ui`, `shared-session-store`) | **202 passed** | vitest and node:test (17 + 38 + 12 + 66 + 56 + 12 + 1) |
| Playwright shell A (scenarios 1-29, incl. design system 20-29) | **29 passed** | `SHELL_A_URL=http://localhost:8090` |
| Playwright B/C smoke | **2 passed** | `SHELL_B_URL=http://localhost:8091`, `SHELL_C_URL=http://localhost:8092` (31 total, 0 skipped) |
| Typecheck (shells, remotes, shell-ui, design-system packages) | **pass** | MF config files excluded from tsc where SDK types are non-portable |
| Build, `check:css` (3 shells, 2 remotes), `check:styles` | **pass** | `check:css` runs after `pnpm build` |

## Docs

- [Architecture](docs/architecture.md)
- [Decision: session DI](docs/decisions/001-session-di.md)
- [Measurement plan](docs/measurement-plan.md)
- [Limitations](docs/limitations.md)
- [AGENTS.md](AGENTS.md)

## Suggested next pilot step

Adopt DI **A** in one real shell with a single remote; keep query clients remote-owned; replace mock-api with your IdP behind the same `SessionApi` commands; add SSR request-scoped session only if required.
