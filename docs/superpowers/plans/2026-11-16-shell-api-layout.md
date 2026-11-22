# Shell API: Global State, Layout and Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give remotes a per-mount `ShellApi` for shell-owned navigation, language and user state, plus remote-driven layout specs and header/sidebar slots, without weakening the session safety rules.

**Architecture:** New `ShellApi` types and validators go in `@poc/platform-contracts`. A new shell-internal package `@poc/shell-state` holds a private zustand vanilla store, per-mount facades, layout and slot bookkeeping, and a lifecycle wrapper that revokes contributions on block, unmount and identity transitions. `@poc/shell-ui` renders the layout and wires facades into `RemoteHost`. Both remotes consume the API and show one example each.

**Tech Stack:** TypeScript 5.9, zustand 5.1 (vanilla), vitest 5.1, React 19 (shell and React remote), Vue (Vue remote), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-shell-api-layout-design.md`

## Global Constraints

- `@poc/platform-contracts`: types and small validators only. No store instances.
- Remotes depend only on `@poc/platform-contracts`. `@poc/shell-state` is shell-internal; remotes must not import it.
- `SessionApi` and its `contractVersion` are unchanged. `SHELL_CONTRACT_VERSION = 1`.
- `MountCapabilities.shell?: ShellApi` is optional. Remotes must mount and work without it.
- Languages: `"en" | "th"`, default `"en"`. Slots: `"header" | "sidebar"`. Default path `/orders`.
- Path pattern `^/[a-z0-9/_-]*$`. Routes: `/orders` is owned by remote `react`, `/summary` by remote `vue`.
- Layout limits: at most 5 actions, at most 6 breadcrumbs, labels at most 40 characters, strings only. Render as text nodes, never HTML.
- Error codes: `INVALID_PATH`, `INVALID_LANGUAGE`, `INVALID_LAYOUT`, `SLOT_TAKEN`, `FACADE_REVOKED`.
- Language and path changes never change `contextRevision`.
- The 9 existing Playwright scenarios for shell A keep passing, with both remotes mounted side by side and existing `data-testid`s kept.
- Fictional data only. Ports: mock-api 4010, remotes 5001 and 5002, shells 8090 to 8092.
- Do not log credentials. Do not expose raw store or `setState`.

## Review Focus

- A second `transitioning` snapshot arrives while one is already running (rapid account switches): slots must not render twice or leak elements.
- A remote unmounts during a transition and the transition then completes: nothing is rendered for the gone remote.
- A slot's `render` or its cleanup throws: the error is contained, the element is emptied, the shell keeps working.
- The transition ends in `error` status (no resume): slot content stays removed (fail closed).
- Layout text that looks like HTML (`<img src=x onerror=...>`) or exceeds limits: shown as plain text or rejected, never parsed.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/platform-contracts/src/shell.ts` | Shell types, constants, `ShellCommandError`, validators |
| `packages/platform-contracts/src/lifecycle.ts` | Add `shell?` to `MountCapabilities` |
| `packages/shell-state/src/createShellRuntime.ts` | Runtime: state, facades, layout, slots, revocation |
| `packages/shell-state/src/index.ts` | Public exports |
| `packages/shell-ui/src/ShellApp.tsx`, `RemoteHost.tsx`, `ShellChrome.tsx` (new) | Layout rendering and wiring |
| `apps/remote-react/src/shellAdapter.ts`, `i18n.ts`, `App.tsx`, `mount.tsx` | React remote example |
| `apps/remote-vue/src/shellAdapter.ts`, `i18n.ts`, `SidebarCard.vue`, `App.vue`, `mount.ts` | Vue remote example |
| `tests/e2e/specs/a-shell.spec.ts`, `page-objects/ShellPage.ts` | Playwright |

---

### Task 1: Shell contract and validators

**Files:**
- Create: `packages/platform-contracts/src/shell.ts`, `packages/platform-contracts/src/shell.test.ts`
- Modify: `packages/platform-contracts/src/index.ts`, `packages/platform-contracts/src/lifecycle.ts`

**Interfaces:**
- Produces (exported from `@poc/platform-contracts`), exactly as in spec 5.1: `SHELL_CONTRACT_VERSION`, `Language`, `SlotId`, `ShellUser`, `ShellState`, `LayoutAction`, `Breadcrumb`, `LayoutSpec`, `ShellApi`, and `MountCapabilities.shell?: ShellApi`.
- Produces: `class ShellCommandError extends Error { readonly code: ShellErrorCode }`, `type ShellErrorCode`.
- Produces: `assertPath(path: string): string`, `assertLanguage(code: string): Language`, `validateLayoutSpec(spec: LayoutSpec): LayoutSpec`. Each throws `ShellCommandError` with the code from Global Constraints. `assertPath` checks the pattern only; the route table check is the runtime's job.

- [ ] **Step 1: Write failing tests** in `shell.test.ts`:
  - `assertPath("/orders/ord_1")` returns it; `assertPath("orders")`, `assertPath("/Orders")`, `assertPath("/a b")` each throw code `INVALID_PATH`.
  - `assertLanguage("th")` returns `"th"`; `assertLanguage("fr")` throws `INVALID_LANGUAGE`.
  - `validateLayoutSpec` accepts a spec with 5 actions and 6 breadcrumbs; rejects 6 actions, 7 breadcrumbs, a 41-character label, and a non-string title, each with `INVALID_LAYOUT`. It accepts `{ title: "<img src=x onerror=alert(1)>" }` unchanged (it is only text).
  - `new ShellCommandError("SLOT_TAKEN", "x")` has `.code === "SLOT_TAKEN"` and `.name === "ShellCommandError"`.
- [ ] **Step 2: Run** `pnpm --filter @poc/platform-contracts test`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `shell.ts`, re-export it from `index.ts`, add `shell?: ShellApi` to `MountCapabilities`. Follow the style of `errors.ts` and `validate.ts`.
- [ ] **Step 4: Run** the same test plus `pnpm --filter @poc/platform-contracts typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contracts): add ShellApi contract and validators`.

---

### Task 2: `@poc/shell-state` package, state, and view

**Files:**
- Create: `packages/shell-state/package.json`, `tsconfig.json`, `vitest.config.ts` (copy structure from `packages/session-coordinator`), `src/index.ts`, `src/createShellRuntime.ts`, `src/createShellRuntime.test.ts`
- Modify: `pnpm-lock.yaml` via `pnpm install`

**Interfaces:**
- Consumes: Task 1 types and validators; `SessionApi`.
- Produces:
  ```ts
  export type ShellView = { activeRemoteId: string | null; layout: LayoutSpec | null };
  export type ShellRuntimeOptions = {
    session: SessionApi;
    routes: Record<string, string>;                 // path prefix -> remoteId
    resolveUser(subjectId: string): ShellUser | null;
    initialPath?: string;                           // default "/orders"
  };
  export interface ShellRuntime {
    getState(): Readonly<ShellState>;
    getView(): Readonly<ShellView>;
    subscribe(onChange: () => void): () => void;    // notified on any state or view change
    forRemote(remoteId: string): ShellApi;
    registerRemote(remoteId: string, lifecycle: RemoteLifecycle): RemoteLifecycle;
    unregisterRemote(remoteId: string): void;
    attachSlotElement(id: SlotId, el: HTMLElement | null): void;
    shellNavigate(path: string): void;              // same validation as ShellApi.navigate, for the shell UI
    shellSetLanguage(code: Language): void;         // same validation as ShellApi.setLanguage
    dispose(): void;
  }
  export function createShellRuntime(options: ShellRuntimeOptions): ShellRuntime;
  ```
- Later tasks add behavior behind `forRemote`, `registerRemote`, `unregisterRemote` and `attachSlotElement`. This task implements state, `navigate`, `setLanguage`, `subscribe`, `getView` (always `{ activeRemoteId, layout: null }` for now), and stubs the rest (including `shellNavigate` and `shellSetLanguage`, which Task 5 implements) to throw "not implemented".

- [ ] **Step 1: Write failing tests** (use a fake `SessionApi` with a settable snapshot and listener set):
  - initial `getState()` is `{ path: "/orders", language: "en", user: null }` for an anonymous session.
  - `navigate("/summary")` updates `path`; `navigate("/nope")` throws `INVALID_PATH` (valid pattern, no route prefix match); `navigate("/orders/ord_1")` is allowed because `/orders` is a prefix.
  - `setLanguage("th")` updates `language`; `setLanguage("fr" as never)` throws `INVALID_LANGUAGE`.
  - `getState()` returns the same object reference until a field changes; `navigate` to the current path does not notify.
  - `user` follows the session: authenticated snapshot with `subjectId: "user_ava"` yields `resolveUser("user_ava")`; `transitioning` and `anonymous` yield `null`.
  - `getView().activeRemoteId` is `"react"` for `/orders/ord_1` and `"vue"` for `/summary`.
  - `navigate` and `setLanguage` never call `session.getSnapshot().contextRevision` changes (assert the fake session was not asked to change).
  - `subscribe` returns a working unsubscribe; `dispose` removes the session listener.
- [ ] **Step 2: Run** `pnpm install && pnpm --filter @poc/shell-state test`. Expected: FAIL.
- [ ] **Step 3: Implement** with zustand vanilla (private store), freezing state objects. Match `createSessionCoordinator.ts` style.
- [ ] **Step 4: Run** tests and `pnpm --filter @poc/shell-state typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shell-state): shell runtime state, navigation and language`.

---

### Task 3: Facade, layout and slots

**Files:**
- Modify: `packages/shell-state/src/createShellRuntime.ts`, `createShellRuntime.test.ts`

**Interfaces:**
- Consumes: Task 2 runtime.
- Produces behavior of `forRemote(remoteId): ShellApi` (new facade per call; a call for an id that already has a live facade revokes the old one first) and `attachSlotElement`:
  - `setLayout(spec)` validates, stores per remote id, replaces any previous spec, returns a release. `getView().layout` is the active remote's spec or `null`.
  - `claimSlot(id, render)` throws `SLOT_TAKEN` if another claim holds the slot. If the slot element is attached, calls `render(el)` once and stores the returned cleanup; otherwise waits for `attachSlotElement`. Returns a release that runs cleanup (in try/catch) and `el.replaceChildren()`.
  - `attachSlotElement(id, el)`: with an element, renders any pending claim; with `null`, runs cleanup and forgets the element.
  - A `render` that throws, or a cleanup that throws, is caught; the element is emptied; the claim is dropped for a throwing `render`.
  - `revoke(remoteId)` (internal, used by Task 4): releases the layout and all slot claims of that remote and marks its facade revoked. A revoked facade's `navigate`, `setLanguage`, `setLayout`, `claimSlot` throw `FACADE_REVOKED`; release functions, `getState`, `subscribe` still work and release is idempotent.

- [ ] **Step 1: Write failing tests**:
  - two facades: react's `setLayout({title:"A"})` and vue's `setLayout({title:"B"})`; with path `/orders` the view layout title is `"A"`, after `navigate("/summary")` it is `"B"`; releasing react's does not touch vue's.
  - `setLayout` with an invalid spec throws `INVALID_LAYOUT` and leaves the previous spec in place.
  - `claimSlot("header", r)` before any element: `r` not called; after `attachSlotElement("header", el)`: called once with `el`.
  - second `claimSlot("header", ...)` from another facade throws `SLOT_TAKEN`; after the first release, the claim succeeds.
  - release runs cleanup once and empties `el`; calling release twice runs cleanup once.
  - `render` throws: no exception escapes `attachSlotElement`, `el` is empty, the slot can be claimed again.
  - cleanup throws on release: no exception escapes, `el` is empty.
  - re-attaching the same element does not call `render` twice.
  - after `revoke("react")`, `setLayout`, `claimSlot`, `navigate`, `setLanguage` on the react facade throw `FACADE_REVOKED`, its releases do not throw, and `getView().layout` no longer shows its spec.
  - action `onSelect` is not invoked by the runtime (the UI calls it); layout spec stored by reference is frozen copy: mutating the original spec after `setLayout` does not change the view.
- [ ] **Step 2: Run** tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep claims in a `Map<SlotId, {remoteId, render, cleanup?}>` and elements in a `Map<SlotId, HTMLElement>`. Use jsdom only if vitest needs it for `HTMLElement`; otherwise use `happy-dom` or minimal fakes with `replaceChildren` (pick the lighter and add it as a devDependency).
- [ ] **Step 4: Run** tests and typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shell-state): per-mount facade, layout and slots`.

---

### Task 4: Transition revocation and lifecycle wrapper

**Files:**
- Modify: `packages/shell-state/src/createShellRuntime.ts`, `createShellRuntime.test.ts`

**Interfaces:**
- Consumes: Task 3 (`revoke`, claims, view).
- Produces:
  - `registerRemote(remoteId, lifecycle)` returns a `RemoteLifecycle` that delegates every method, with these additions: `block(reason)` calls `revoke(remoteId)` first, then delegates; `resume(ctx)` delegates first, then re-renders that remote's retained slot claims into their attached elements (only if the remote is registered, not blocked, and the session is not `transitioning`); `dispose()` revokes then delegates.
  - `unregisterRemote(remoteId)` revokes the remote.
  - Session subscription: on a snapshot whose `status` is `transitioning`, for every remote: clear its layout spec, run each slot cleanup and empty the element but keep the claim and `render`; and set `path` to its route root (`/orders/ord_1` becomes `/orders`; paths already at a root stay). Repeated `transitioning` snapshots are idempotent (cleanup runs once per render).
  - A snapshot with status `error` or `anonymous` or `authenticated` triggers nothing by itself; slots return only through the wrapper's `resume`.

- [ ] **Step 1: Write failing tests** (fake session; fake lifecycle with spies):
  - on `transitioning`: layout cleared, header cleanup called once, element empty, claim retained; `path` `/orders/ord_1` becomes `/orders`; `/summary` stays.
  - two consecutive `transitioning` snapshots: cleanup called once, no throw.
  - wrapper `resume`: delegate called before `render(el)` runs a second time; element gets new content.
  - wrapper `block` during transition: after a later `resume` call on the wrapper, `render` is not called again and the facade is revoked.
  - `unregisterRemote` during a transition then wrapper `resume` called late: `render` not called.
  - transition ending in `error` snapshot without `resume`: element stays empty.
  - wrapper delegates `prepareTransition`, `resetIdentityState`, and passes ctx and reason through unchanged; if the delegate's `resetIdentityState` rejects, the rejection propagates.
  - `navigate`, `setLanguage` while `transitioning` do not throw and do not re-render slots.
- [ ] **Step 2: Run** tests. Expected: FAIL.
- [ ] **Step 3: Implement** the wrapper and the session subscription.
- [ ] **Step 4: Run** `pnpm --filter @poc/shell-state test` and typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shell-state): revoke contributions on block, unmount and transitions`.

---

### Task 5: Shell chrome in `@poc/shell-ui`

**Files:**
- Create: `packages/shell-ui/src/ShellChrome.tsx`
- Modify: `packages/shell-ui/src/ShellApp.tsx`, `RemoteHost.tsx`, `types.ts`, `index.ts`, `package.json` (add `@poc/shell-state`)

**Interfaces:**
- Consumes: Task 4 runtime.
- Produces:
  - `ShellApp` creates one runtime (`useMemo`) with `routes = { "/orders": "react", "/summary": "vue" }`, `resolveUser` from `FICTIONAL_USERS` (`displayName`), and the `session` prop. It disposes it on unmount.
  - `RemoteHost` takes a new prop `runtime: ShellRuntime`. In its mount effect it calls `runtime.forRemote(id)`, mounts with `{ ...capabilities, shell }`, registers `runtime.registerRemote(id, handle.lifecycle)` with the coordinator registry, and on dispose calls `registry.unregister(id)` then `runtime.unregisterRemote(id)` then `handle.unmount()`.
  - `ShellChrome({ runtime })` renders, using `useSyncExternalStore` on `runtime.subscribe`: top bar with title, breadcrumbs (buttons that call `runtime.shellNavigate`), layout actions (clicking calls `onSelect` inside try/catch and logs `layout.action.error` through `onEvent` on failure), language select (calls `runtime.shellSetLanguage`), user label; nav with Orders and Summary; a `header` slot container and a `sidebar` slot container whose refs call `attachSlotElement`.
  - `data-testid`s: `shell-title`, `shell-breadcrumbs`, `shell-action-<id>`, `shell-nav-orders`, `shell-nav-summary`, `language-select`, `shell-user`, `shell-path`, `slot-header`, `slot-sidebar`.
  - Existing panel, toggles, scenario controls, event log and their test ids stay unchanged.

- [ ] **Step 1: Write the failing check.** `shell-ui` has no unit test runner; add `shellNavigate`/`shellSetLanguage` tests to `createShellRuntime.test.ts` first (same validation as the facade commands, no facade needed, work even when no remote is registered), run them: FAIL.
- [ ] **Step 2: Implement** the two runtime helpers declared in Task 2's interface (throw "not implemented" there until now), run them: PASS.
- [ ] **Step 3: Implement** `ShellChrome`, `RemoteHost` and `ShellApp` changes. Layout text goes in as React text children only. Mirror `path` to `location.hash` in `ShellChrome` (set hash on state change; on `hashchange` call `shellNavigate` when valid).
- [ ] **Step 4: Verify** `pnpm typecheck` and `pnpm --filter @poc/shell-injected build`. Expected: pass. Start `pnpm dev:poc` and confirm the page renders the nav and empty slots, and the 9 existing scenarios still pass: `SHELL_A_URL=http://localhost:8090 pnpm test:e2e`.
- [ ] **Step 5: Commit** `feat(shell-ui): shell chrome, layout rendering and facade wiring`.

---

### Task 6: React remote example

**Files:**
- Create: `apps/remote-react/src/shellAdapter.ts`, `apps/remote-react/src/i18n.ts`
- Modify: `apps/remote-react/src/App.tsx`, `apps/remote-react/src/mount.tsx`

**Interfaces:**
- Consumes: `capabilities.shell?: ShellApi`.
- Produces: `useShellState(shell: ShellApi | undefined): Readonly<ShellState> | null` (`useSyncExternalStore`, null without shell); `t(language: Language, key: keyof typeof en): string` with `en` and `th` dictionaries for: heading, "Sign in" hint, "Open", "Back to orders", "Order not found", "Open orders" and "Refresh orders". The English heading stays `Fictional React Orders` and existing English body strings stay as they are, because current scenarios assert them.

Behavior:
- Orders list shows an "Open" button per order. It calls `shell.navigate("/orders/<id>")`. For path `/orders/<id>` the remote shows that order's detail, or "Order not found" when the id is not in the loaded list (for example after an account switch).
- Layout: on path or language or session change (and in `lifecycle.resume`), calls `shell.setLayout` with: title `Orders` or `Order <id>`, breadcrumbs `[Orders]` plus `[Order <id>]` on detail, and one action `{ id: "refresh", label: t("Refresh orders"), onSelect: () => queryClient.invalidateQueries() }`. Keeps the previous release and calls it before setting a new one.
- Header slot: `shell.claimSlot("header", el => { render a second React root with the same QueryClientProvider showing "Open orders: N"; return () => root.unmount() })`. `render` builds from current state only, so the shell can call it again after a transition.
- Without `capabilities.shell`, none of the above runs and the remote behaves as before.
- `dispose` releases layout and slot, in addition to current cleanup.

- [ ] **Step 1: Implement** adapter, i18n, App and mount changes.
- [ ] **Step 2: Verify** `pnpm --filter @poc/remote-react typecheck`, `pnpm --filter @poc/remote-react build`. Expected: pass.
- [ ] **Step 3: Manual check** with `pnpm dev:poc`: login, click "Open" on an order, confirm title, breadcrumbs, refresh action, header badge. Then run the existing e2e: `SHELL_A_URL=http://localhost:8090 pnpm test:e2e`. Expected: 9 passed.
- [ ] **Step 4: Commit** `feat(remote-react): shell state, layout and header slot example`.

---

### Task 7: Vue remote example

**Files:**
- Create: `apps/remote-vue/src/shellAdapter.ts`, `apps/remote-vue/src/i18n.ts`, `apps/remote-vue/src/SidebarCard.vue`
- Modify: `apps/remote-vue/src/App.vue`, `apps/remote-vue/src/mount.ts`

**Interfaces:**
- Produces: `useShellState(shell: ShellApi | undefined)` returning a readonly `shallowRef` of the state (null without shell), unsubscribing with `onScopeDispose`; `t(language, key)` with `en` and `th` for: heading, "Open orders", "Language", "Account". English heading stays `Fictional Vue Account Summary`.

Behavior:
- App shows the heading and labels in the shell language and shows the shell's user display name.
- Sidebar slot: `shell.claimSlot("sidebar", el => { create a second Vue app with SidebarCard (account summary: name and open orders from the remote's current Apollo summary, plus a language picker whose change calls shell.setLanguage); return () => app.unmount() })`. `render` builds from current state and must not hold a stale Apollo client: read the client through a getter, since identity reset recreates it.
- Layout: sets `{ title: "Account summary", breadcrumbs: [{label:"Summary"}] }` on mount, on language change and in `lifecycle.resume`.
- Without `capabilities.shell`, behaves as before. `dispose` releases layout and slot.

- [ ] **Step 1: Implement** the files above.
- [ ] **Step 2: Verify** `pnpm --filter @poc/remote-vue typecheck` and build. Expected: pass.
- [ ] **Step 3: Manual check:** login, confirm sidebar card, change language in the picker and see both remotes and the top bar change. Run existing e2e. Expected: 9 passed.
- [ ] **Step 4: Commit** `feat(remote-vue): shell state, layout and sidebar slot example`.

---

### Task 8: Playwright coverage

**Files:**
- Create: `tests/e2e/specs/a-shell.spec.ts`
- Modify: `tests/e2e/page-objects/ShellPage.ts`, `tests/e2e/specs/bc-smoke.spec.ts`

**Interfaces:**
- Page object additions: `title()`, `breadcrumbs()`, `action(id)`, `navTo("orders"|"summary")`, `setLanguage("en"|"th")`, `slot("header"|"sidebar")`, `path()`, `shellUser()`, mapped to the test ids in Task 5.

- [ ] **Step 1: Write the specs** (shell A, using `MockApiControls` and the existing `beforeEach`):
  - `10 language set in the shell reaches both remotes`: login, `setLanguage("th")`, both `remoteRoot`s show their Thai heading; `contextRevision` text unchanged.
  - `11 language set by a remote reaches the shell and the other remote`: change language from the sidebar picker; the shell language select and the React heading change.
  - `12 remote navigate and layout`: click "Open" on an order; `path()` shows `/orders/<id>`, `title()` contains `Order`, breadcrumbs show Orders; clicking the refresh action triggers a new orders request.
  - `13 shell nav drives remote view and active layout`: `navTo("summary")` changes the title to `Account summary`; `navTo("orders")` returns.
  - `14 slots render remote content`: after login, header slot contains `Open orders`, sidebar contains the North account name.
  - `15 no old-account text in slots during a switch`: delay the Vue summary (mock-api `__controls`), switch to South; while status is `transitioning`, `slot("sidebar")` does not contain `North`; after the switch it contains `South`; path was truncated to `/orders`.
  - `16 forced cleanup failure removes slot content`: enable force cleanup fail, switch account; the failing remote's slot is empty and stays empty after the transition; unchecking and remounting that remote restores it.
  - `17 unmount removes layout and slots`: toggle React off; header slot empty and its layout actions gone; toggle on; they return.
  - `18 action errors do not break the shell`: skip if there is no way to throw from an action; otherwise cover with the unit test already in Task 3.
- [ ] **Step 2: Run** `SHELL_A_URL=http://localhost:8090 pnpm test:e2e`. Expected: new specs and the 9 old ones pass (drop 18 if skipped).
- [ ] **Step 3: B and C smoke:** in `bc-smoke.spec.ts` assert `slot-header` contains `Open orders` and `shell-nav-orders` is visible after login. Run with `SHELL_B_URL` and `SHELL_C_URL`. Expected: pass.
- [ ] **Step 4: Commit** `test(e2e): shell state, layout and slot scenarios`.

---

### Task 9: Docs and full verification

**Files:**
- Modify: `AGENTS.md`, `docs/limitations.md`, `README.md` (add the new scenarios and `@poc/shell-state` to the package list)

- [ ] **Step 1: Update** `AGENTS.md`: add a `ShellApi` ownership line (shell owns navigation, language and user state; remotes own cache), mark `@poc/shell-state` as shell-internal like the coordinator, and add remote rules (resolve `capabilities.shell` optionally, release layout and slots in `dispose`, re-send layout in `resume`, build slot content from current state only).
- [ ] **Step 2: Update** `docs/limitations.md`: slots are same-realm DOM with no isolation or CSS sandbox; a remote can touch anything reachable from its slot element.
- [ ] **Step 3: Run the full set:** `pnpm install && pnpm typecheck && pnpm test:unit && pnpm build`, then `SHELL_A_URL=http://localhost:8090 SHELL_B_URL=http://localhost:8091 SHELL_C_URL=http://localhost:8092 pnpm test:e2e`. Expected: all pass, 0 skipped.
- [ ] **Step 4: Commit** `docs: document ShellApi, slots and limitations`.

---

## Self-Review

- **Spec coverage:** 5.1 contract (Task 1), 5.2 runtime state (Task 2), 5.3 layout and slots (Task 3), 5.4 revocation (Task 4), 5.5 wiring (Task 5), 5.6 examples (Tasks 6 and 7), 5.7 tests (Tasks 1 to 4 and 8), 5.8 docs (Task 9). The spec's "artifact later" step is out of scope.
- **Type consistency:** `ShellRuntime` methods (`forRemote`, `registerRemote`, `unregisterRemote`, `attachSlotElement`, `getView`, `shellNavigate`, `shellSetLanguage`) are defined in Tasks 2 and 5 and used the same way in Tasks 3 to 5. `ShellApi` names match the spec.
- **Known weak spot:** `shellNavigate` and `shellSetLanguage` are not in the spec. They are the minimum for a shell-owned nav and language select that has no facade.
