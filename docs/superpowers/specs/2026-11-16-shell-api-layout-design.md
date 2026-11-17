# Shell API: Global State, Layout and Slots for Remotes

**Status:** Draft for user review
**Date:** 2026-11-16
**Type:** POC extension (builds on `2026-11-14-session-coordination-mfe-design.md`). Not production.

## 1. Intent

Today the shell and remotes share identity (`SessionApi`) and cleanup (`RemoteLifecycle`). The shell has no layout, and a remote cannot ask the shell to do anything except change the session.

This work adds the second half of shell-to-remote communication, so the POC can demonstrate it end to end:

1. **Shared global state owned by the shell:** navigation (current path), selected language, and user info. Remotes read it and react to changes.
2. **Remote-to-shell actions:** a remote can navigate, change the language, and shape the shell's layout.
3. **Shell layout that depends on remote actions**, in two forms:
   - **Declarative:** a remote sends a layout spec (title, breadcrumbs, toolbar actions) and the shell renders it.
   - **Slots:** a remote renders its own content into shell-owned regions (header, sidebar).

Why: the owner wants to show that the shell can stay the single owner of the page while remotes drive it, without remotes importing shell internals, and without the new state weakening the session safety rules (no stale-account content, fail closed).

The architecture artifact is updated after this is built, not before.

## 2. Goals, non-goals, anti-goals

**Goals**
- A new `ShellApi` contract in `@poc/platform-contracts`, framework-neutral, same shape of idea as `SessionApi`: `getState()`, `subscribe()`, typed commands.
- A per-remote facade, so the shell knows which remote contributed what and can revoke it.
- Working examples in both remotes (React and Vue): shell data flowing down, remote actions flowing up, one declarative layout, one slot each.
- Contributions from a remote never outlive that remote, and never show old-account content during or after an identity transition.
- Unit tests and Playwright coverage, with the 9 existing shell A scenarios still green.

**Non-goals**
- A real router, deep links, SSR, a real i18n library, theming, auth, cross-origin iframes.
- More slots than `header` and `sidebar`.
- Updating the artifact or `docs/architecture.md` diagrams (separate step after build, but `AGENTS.md` and `docs/limitations.md` are updated in this work).

**Anti-goals (failure even if it works)**
- Language or navigation changes bumping `contextRevision` or triggering a session transition.
- A remote reaching another remote's contributions, a raw store, `setState`, or the coordinator.
- Remote-contributed content remaining visible after the remote is blocked or unmounted.
- Domain data (orders, account summary) copied into shell state.

## 3. Constraints

- `AGENTS.md` ownership rules hold. `@poc/platform-contracts` stays types plus small validators, no store instances. Remotes depend only on it.
- `SessionApi` and its `contractVersion` are unchanged. `ShellApi` has its own `contractVersion = 1`.
- `MountCapabilities` gains optional `shell?: ShellApi`. A remote must still mount and work when `shell` is absent (no layout, no slots).
- Same JS realm: slots give remotes DOM access inside the shell page. This is not a sandbox, and `docs/limitations.md` says so.
- Existing mount and lifecycle contract keeps working. The 9 existing Playwright scenarios (A) stay unchanged and passing, so both remotes stay mounted side by side.
- All data is fictional. Rendered text from remotes goes in as text, never as HTML.

## 4. Approaches considered

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **1. Per-remote `ShellApi` facade** | Shell can attribute and revoke every contribution. Adds a per-remote object and a revocation rule to test. | **Chosen** |
| 2. One shared `ShellApi`, remote passes its id | Simpler. A remote can pass another remote's id, so ownership cannot be enforced. | Rejected |
| 3. `window` events | No snapshot, late remotes miss events, no clean revocation. Same flaws as session DI option D. | Rejected |
| Slots via extra MF modules (`./header`) mounted by the shell | Shell keeps control, but the remote cannot change contributions at runtime. | Rejected for slots. Chosen approach uses `claimSlot` with a render callback. |

The owner chose both declarative layout and slots, and Approach 1.

## 5. Design

### 5.1 Contract (`@poc/platform-contracts`, new `shell.ts`)

```ts
export const SHELL_CONTRACT_VERSION = 1 as const;

export type Language = "en" | "th";
export type SlotId = "header" | "sidebar";

export type ShellUser = { subjectId: string; displayName: string };
export type ShellState = {
  path: string;                 // e.g. "/orders", "/orders/ord_1", "/summary"
  language: Language;
  user: ShellUser | null;       // derived from session, read-only for remotes
};

export type LayoutAction = { id: string; label: string; disabled?: boolean; onSelect: () => void };
export type Breadcrumb = { label: string; path?: string };
export type LayoutSpec = { title?: string; breadcrumbs?: Breadcrumb[]; actions?: LayoutAction[] };

export interface ShellApi {
  readonly contractVersion: typeof SHELL_CONTRACT_VERSION;
  getState(): Readonly<ShellState>;                 // stable identity until a field changes
  subscribe(onChange: () => void): () => void;
  navigate(path: string): void;                     // sync; throws ShellCommandError("INVALID_PATH")
  setLanguage(code: Language): void;                // sync; throws ShellCommandError("INVALID_LANGUAGE")
  setLayout(spec: LayoutSpec): () => void;          // replaces this remote's spec; returns release
  claimSlot(id: SlotId, render: (el: HTMLElement) => () => void): () => void; // throws SLOT_TAKEN. render may be called again after a transition
}
```

- `MountCapabilities` adds `shell?: ShellApi`.
- Small validators live beside the types: `assertPath`, `assertLanguage`, `validateLayoutSpec` (at most 5 actions, at most 6 breadcrumbs, labels at most 40 characters, strings only).
- `ShellCommandError` mirrors `SessionCommandError` with codes `INVALID_PATH`, `INVALID_LANGUAGE`, `INVALID_LAYOUT`, `SLOT_TAKEN`, `FACADE_REVOKED`.

### 5.2 Shell-internal runtime (new package `@poc/shell-state`)

Shell-internal, like `@poc/session-coordinator`: remotes must not import it (added to `AGENTS.md`). Zustand vanilla store, private.

`createShellRuntime({ session, routes })` returns:
- `forRemote(remoteId): ShellApi`, the per-mount facade (a new one per mount).
- `registerRemote(remoteId, lifecycle): RemoteLifecycle` and `unregisterRemote(remoteId)`, see 5.4.
- Read access for the shell UI: current state, the merged layout, slot claims.
- `routes` is shell config mapping a path prefix to the remote that owns it: `/orders` to `react`, `/summary` to `vue`.

State rules:
- `path`: shell-owned, default `/orders`. `navigate` validates against the route table and the pattern `^/[a-z0-9/_-]*$`. The shell mirrors `path` to `location.hash`. No router library.
- `language`: shell-owned, default `en`, allowed `en` and `th`.
- `user`: derived from the session snapshot, with `displayName` resolved shell-side from fixtures. `null` when anonymous or transitioning.
- Commands are synchronous and independent of the session. They never touch `contextRevision`.

### 5.3 Layout and slots

**Declarative layout**
- Each remote's facade stores at most one `LayoutSpec`. `setLayout` replaces it and returns a release function.
- The shell renders title, breadcrumbs and actions only from the **active remote**, the one whose route prefix matches the current `path`. Other remotes' specs are stored but not rendered.
- A toolbar action is rendered by the shell. On click the shell calls `onSelect` inside try/catch. A throw is logged to the event log and does not break the shell.
- All text is rendered as text nodes.

**Slots**
- The shell renders `header` and `sidebar` containers.
- `claimSlot(id, render)`: the shell calls `render(el)` with the slot element (deferred until the element exists). The remote renders its own React or Vue tree there and returns a cleanup function.
- Slots are exclusive. A second claim on a taken slot throws `SLOT_TAKEN`.
- Release or revoke: the shell calls the cleanup in try/catch, then `el.replaceChildren()` as a backstop.

### 5.4 Revocation (the safety rules)

Principle: after any identity change, no remote-contributed content from the old context stays in the DOM or in shell state. Content is removed, not hidden.

| Event | Layout spec | Slot content |
| --- | --- | --- |
| Remote unmounts (`unregisterRemote`) | Released | Cleanup called, slot freed |
| Remote is blocked (`block()`) | Released | Cleanup called, slot freed, claim dropped |
| Session enters `transitioning` | **Cleared** | **Cleanup called, `el` emptied.** Claim and `render` kept |
| Session publishes the new snapshot and the remote is resumed | Remote re-sends in `resume()` | **Shell calls `render(el)` again** |
| Remote blocked during the transition | Stays released | Claim dropped, `render` not called again |

- **Slots** are re-rendered by the shell after `resume`, so `render(el)` must build the tree from current state, with no assumptions about earlier calls. This also means a DOM check for old-account text passes during a transition.
- **Layout specs** are static data, so the shell cannot refresh them. A remote re-sends its spec in `resume()` and whenever `path` changes. Remote examples do both.
- **`path` on identity change:** when the session enters `transitioning`, the shell truncates `path` to its route root (`/orders/ord_1` becomes `/orders`), because ids in a path belong to the old account. The React detail view still handles an unknown id (shows "not found").
- **Facade lifetime:** one facade per mount. `RemoteHost` calls `runtime.forRemote(id)` inside its mount effect, so unmount and remount get a fresh one. After unmount or block, the facade is revoked for good. Its commands (`navigate`, `setLanguage`, `setLayout`, `claimSlot`) throw `ShellCommandError("FACADE_REVOKED")`. Release functions and `getState`/`subscribe` still work. A blocked remote stays out until it is remounted, so it cannot repaint old-account content.
- **Slots and routes:** slot claims do not depend on the active route. A healthy mounted remote's header or sidebar stays visible on every path. Only layout (title, breadcrumbs, actions) follows the active remote.
- **How the shell learns about `block()`:** the coordinator is **not changed**. `RemoteHost` registers the wrapper returned by `runtime.registerRemote(id, lifecycle)`. The wrapper's `block()` revokes first, then delegates. The transition steps come from the runtime's own subscription to the session snapshot.

### 5.5 Wiring in the shell

`ShellApp` (in `@poc/shell-ui`) creates one runtime and builds the capabilities per remote:

```ts
capabilities = { ...resolveRemoteCapabilities(opts), shell: runtime.forRemote(id) }
```

- The shell capability is injected in all three shells. DI modes A, B and C only differ in how the **session** reaches remotes. This keeps the comparison clean, and a per-remote facade cannot be a global accessor anyway.
- `resolveRemoteCapabilities` is unchanged in shape. `ShellApp` adds `shell` itself.
- `ShellApp` gains: a top bar (title, breadcrumbs, actions, language selector, user label), a nav (Orders, Summary), a `sidebar` slot region and a `header` slot region. The debug panel, remote mount toggles, scenario controls and event log stay, with their existing `data-testid`s.

### 5.6 Remote examples

| Flow | Direction | Example |
| --- | --- | --- |
| Language | Shell to remote | Shell language selector. Both remotes show labels in the chosen language (small local dictionaries, `en` and `th`) |
| User | Shell to remote | Both remotes show the shell's user display name |
| Path | Shell to remote | Shell nav changes `path`. The React remote shows an order detail for `/orders/<id>` and the list for `/orders` |
| Navigate | Remote to shell | React "Open" on an order calls `navigate("/orders/<id>")` |
| Declarative layout | Remote to shell | React sets title "Order <id>", breadcrumbs, and a "Refresh orders" action that invalidates its query |
| Slot, header | Remote to shell | React renders "Open orders: N" in the `header` slot, using its own query data |
| Slot, sidebar | Remote to shell | Vue renders the account summary card and a language picker in the `sidebar` slot. The picker calls `setLanguage` |

Both remotes read state through a small adapter, like `sessionAdapter`: React `useSyncExternalStore`, Vue `shallowRef`. Both release layout and slots in `dispose`.

### 5.7 Testing

- **Unit, contracts:** validators accept and reject cases; error codes.
- **Unit, `@poc/shell-state`:**
  - facade scoping: one remote cannot affect another remote's contributions
  - exclusive slots and `SLOT_TAKEN`
  - release functions work
  - revocation on unmount and block
  - layout cleared and slot content removed (cleanup called, element empty) on `transitioning`; slot `render` called again after resume; not called again if blocked meanwhile
  - `path` truncated to its route root on transition
  - revoked facade throws `FACADE_REVOKED` on commands, release functions stay safe
  - action callback errors are contained
  - language and path changes leave `contextRevision` unchanged
  - snapshot identity is stable until a field changes
- **Playwright, shell A:** new spec covering language propagation to both remotes, nav and path, remote-driven navigate and layout, header and sidebar slots, and "no North text in the slot DOM while switching to South" and "forced cleanup failure removes slot content". Page object extended.
- **B and C smoke:** layout and slots are present.
- **Regression:** the existing 9 scenarios, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`.

### 5.8 Documentation updates in this work

- `AGENTS.md`: `ShellApi` ownership, `@poc/shell-state` is shell-internal, remote rules for layout and slots.
- `docs/limitations.md`: slots are same-realm DOM with no isolation.
- `docs/architecture.md` and the artifact are updated in the next step.

## 6. Decisions I made (the owner can overrule)

- `ShellApi` is separate from `SessionApi`, so language and navigation never trigger transitions.
- Commands are synchronous, unlike session commands.
- The active remote is chosen by route prefix, and only it renders layout. Both remotes stay mounted.
- Content is removed, not hidden, on any identity change. Slots are re-rendered by the shell after resume. Layout specs are re-sent by remotes in `resume()`.
- `path` is truncated to its route root when a transition starts.
- One facade per mount; a revoked facade throws `FACADE_REVOKED`.
- Slots are always visible for healthy mounted remotes, regardless of route. Slots are exclusive.
- `RemoteHost` wraps the lifecycle for revocation, so the coordinator is untouched.
- The shell capability is injected in all three DI modes.
- New shell-internal package `@poc/shell-state`.
- `path` mirrors to `location.hash`. No router library.

## 7. Left to the builder

- File layout and naming inside the new package.
- Styling and exact i18n strings.
- Details of hash sync and the nav UI.
- Which order and fields the example remotes show, within 5.6.
