# Limitations

## Simulated, not production auth

- Fictional users/accounts only.
- No real IdP, tokens, refresh, or cookie security model.
- mock-api request-scope headers demonstrate the idea; they are not a production security boundary.
- Client-sent `accountId` alone is not authorization.

## Same JS realm

Module Federation remotes share the page realm. Capability injection does not sandbox untrusted code.

## Slots are not isolated

Shell slots (`header`, `sidebar`) hand the remote a plain DOM element in the same realm. There is no iframe, shadow DOM or CSS sandbox: a remote can touch anything reachable from its slot element (parents, siblings, global styles) and the shell only empties the element on release, transition, block, unmount and dispose.

A remote that is not blocked can still set a layout after the session reaches `error`. This is harmless: a layout holds no account data, and held slots stay held (not rendered) until that remote resumes.

## ShellCommandError across bundles

`@poc/platform-contracts` is not shared through Module Federation, so the shell and each remote bundle their own `ShellCommandError` class. `instanceof` fails across bundles; match `error.name === "ShellCommandError"` and `error.code`.

## Hash history

`ShellChrome` mirrors `path` into `location.hash` with `history.replaceState`, so no history entries are pushed: browser Back leaves the app instead of restoring an earlier `/orders/<id>` (which could belong to a previous account). A rejected or truncated hash path is written back to the current `path`. An external edit to the hash (typing in the address bar, a link) still fires `hashchange` and navigates through the usual validation.

## SSR / native excluded

Production SSR needs request-scoped session state. Native/WebView and cross-origin iframe messaging need adapters beyond this POC.

## DI C coupling

`@poc/shared-session-store` is an intentional anti-pattern for comparison.

## Environment notes

- This workstation binds a proxy on `8080` (gvproxy). Shells therefore use **8090/8091/8092**. If Modern.js falls back from a busy configured port, asset URLs can still target the original port and break the UI.
- Playwright requires browser binaries installed once (`pnpm --filter @poc/e2e exec playwright install chromium`).
- Host must share React with `eager: true` for the React remote mount under Modern.js MF.
