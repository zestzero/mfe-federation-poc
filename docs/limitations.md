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

## Design system

- **Duplicate utility CSS.** Every app builds its own utilities, so the same rules ship in the shell and in each remote. Harmless while the theme is identical.
- **Version skew.** Component code is bundled per app, so independently deployed remotes can run different component versions. Only the CSS variables are shared at runtime. Remote CSS also declares global `:root,:host` Tailwind theme variables (spacing, type scale) in `@layer theme`, loaded after the shell's; apps on different Tailwind versions could restyle each other through those variables, so Tailwind must stay pinned to the same version across all apps.
- **Unthemed remote under a foreign shell.** A remote mounted by a shell that does not load the design-system tokens stays usable but unthemed. There are no `var()` fallbacks, so backgrounds become transparent, colours inherit, radius becomes 0 (`calc(var(--radius) - 2px)` is invalid), shadows disappear and borders fall back to `currentColor`. Spacing and type still work because the remote ships its own `:root,:host{--spacing…}`.
- **No CSS isolation in the same realm.** Remote CSS is global; remotes can restyle each other through shared class names. The shell owns preflight, so a remote cannot reset the page.
- **Two component sets.** React and Vue components are kept in sync by shared `variants.ts` classes plus parity and type-level drift tests, not by one implementation.
- **Check (e) waived.** `check:css --remote` has no assertion for a class used only in `@poc/design-system-vue`, because no such class exists (all Vue classes come from `variants.ts`). Add one if a component-local class is ever introduced.
- **Engine literals stripped.** Tailwind emits colour literals inside `@property` and `@supports` blocks (for example `--tw-ring-offset-color:#fff`). The compiled-output guard strips those blocks before the literal check; a `remote.css` override cannot remove them.
- **`check:css` needs a build first.** It reads `dist`. Root `pnpm check:css` runs it in every app and is the last step of `pnpm ci` (after `pnpm build`).
- **Federated CSS.** No fix was needed: a CSS import in the exposed `mount` module is extracted as an expose CSS asset, listed in `mf-manifest.json`, and injected by the shell's MF runtime as a `<link>`. Verified in a browser in dev and statically in production builds (production remotes were not served in a browser). Whether the link is removed on unmount is unverified.
- **Vue remote standalone.** Opening the Vue remote alone on 5002 throws `RUNTIME-006` (`loadShareSync` for `vue`). Not confirmed as pre-existing; the federated path is unaffected.

## SSR / native excluded

Production SSR needs request-scoped session state. Native/WebView and cross-origin iframe messaging need adapters beyond this POC.

## DI C coupling

`@poc/shared-session-store` is an intentional anti-pattern for comparison.

## Environment notes

- This workstation binds a proxy on `8080` (gvproxy). Shells therefore use **8090/8091/8092**. If Modern.js falls back from a busy configured port, asset URLs can still target the original port and break the UI.
- Playwright requires browser binaries installed once (`pnpm --filter @poc/e2e exec playwright install chromium`).
- Host must share React with `eager: true` for the React remote mount under Modern.js MF.
