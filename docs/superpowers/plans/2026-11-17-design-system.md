# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shell and both remotes one consistent look through shared Tailwind v4 tokens and shadcn (React) / shadcn-vue components, with the shell owning the token values at runtime.

**Architecture:** `@poc/design-system` holds the Tailwind theme mapping (no values), the token values (shell only), shell and remote CSS entries, `cn()`, and shadcn React components. `@poc/design-system-vue` holds the same components for Vue and reuses the CSS from the first package. Each app builds its own Tailwind CSS through PostCSS; remote CSS only references `var(--token)`, so the shell's `:root`/`.dark` values restyle every remote at runtime.

**Tech Stack:** Tailwind v4 (`tailwindcss`, `@tailwindcss/postcss`, 4.3.x), shadcn CLI 4.x (React), shadcn-vue 2.x with Reka UI (Vue), `class-variance-authority`, `clsx`, `tailwind-merge`, Modern.js 3 (shells), Rsbuild 2 (remotes), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-design-system-design.md`

**Branching:** Branch `feat/design-system` from `feat/shell-api-layout` (stacked on PR #2). The first commit adds this plan and the spec.

## Global Constraints

- Tailwind **v4**, CSS-first `@theme`, `@tailwindcss/postcss`. Not `@modern-js/plugin-tailwindcss` (Modern.js 2). Re-check versions on the npm registry before locking.
- Tokens (semantic, shadcn names): `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `warning`, `warning-foreground`, `border`, `input`, `ring`, plus `--radius`. Light values on `:root`, dark values on `.dark`. One neutral theme.
- `theme.css` (imported by every app) holds the `@theme inline` mapping only: **no colour values**. `tokens.css` holds all values and is imported by the **shell only**. Preflight is imported by the shell only. Remote production CSS has no raw colour values and no preflight.
- `standalone.css` (tokens plus preflight) exists for running a remote alone in development. It is not part of the federated path.
- Selects and checkboxes are styled **native** elements (`<select>`, `<input type="checkbox">`). Existing e2e tests use `selectOption` on `language-select` and `vue-language-picker`, and `isChecked`/`click` on `force-cleanup-fail`.
- All existing `data-testid`s, English strings, element types and DOM nesting that page objects rely on stay unchanged. The 21 existing e2e tests pass unchanged.
- Shell toggles a `dark` class on `<html>`; `data-testid="theme-toggle"`; in memory only; no `ShellApi` or contract change.
- shadcn components are copied into the repo (`components.json` per package). React must not be bundled twice: the design-system React package declares `react` as a peer dependency.
- Remotes may depend on `@poc/design-system` and `@poc/design-system-vue` for UI only. They still must not import `@poc/shell-state` or `@poc/session-coordinator`.
- Cascade layer order is identical in every app: `theme, base, components, utilities`.
- Fictional data only. Commits end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A remote's CSS is not loaded when the remote mounts into the shell, so it renders unstyled (federated CSS gotcha). Test: e2e computed style on a React and a Vue remote element (Task 5 proof, Task 10).
- A remote's built CSS contains raw colour values or preflight, so a shell theme change does not reach it or the remote restyles the shell page. Test: built-CSS check (Task 5).
- Tailwind misses a class used only inside a design-system component or a federated remote (source scanning). Test: built CSS contains a class from each package's own components (Tasks 4 and 5).
- Dark mode leaves slot content unreadable or unchanged. Test: computed colour of header and sidebar slot content flips with `theme-toggle` (Task 10).
- Restyled native controls stop behaving natively (select value, checkbox state). Test: the existing e2e scenarios plus `selectOption` on both language controls (Tasks 6 to 10).

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `packages/design-system/src/{theme,tokens,shell,remote,standalone}.css` | Token mapping, token values, per-app CSS entries |
| `packages/design-system/src/lib/utils.ts` | `cn()` |
| `packages/design-system/src/components/*.tsx`, `src/index.ts` | shadcn React components |
| `packages/design-system/components.json`, `package.json`, `tsconfig.json`, `vitest.config.ts` | Package setup |
| `packages/design-system-vue/src/components/*.vue`, `src/index.ts`, `components.json`, `package.json` | Vue components |
| `apps/shell-{injected,federated,zustand}/{modern.config.ts,src/styles.css}` | PostCSS wiring and shell CSS |
| `apps/remote-{react,vue}/{rsbuild.config.ts,src/styles.css}` | PostCSS wiring and remote CSS |
| `packages/shell-ui/src/*.tsx` | Restyled shell UI and `ThemeToggle.tsx` |
| `apps/remote-react/src/*`, `apps/remote-vue/src/*` | Restyled remotes |
| `tests/e2e/specs/a-design.spec.ts`, `page-objects/ShellPage.ts` | New scenarios |
| `docs/design-system.md`, `AGENTS.md`, `docs/limitations.md`, `README.md` | Docs |

---

### Task 1: `@poc/design-system` package, tokens and `cn()`

**Files:**
- Create: `packages/design-system/{package.json,tsconfig.json,vitest.config.ts,components.json}`, `src/{theme,tokens,shell,remote,standalone}.css`, `src/lib/utils.ts`, `src/index.ts`, `src/tokens.test.ts`
- Modify: `pnpm-lock.yaml` via `pnpm install`

**Interfaces:**
- Produces: package `@poc/design-system` with `exports`: `"."` (components, `cn`), `"./theme.css"`, `"./tokens.css"`, `"./shell.css"`, `"./remote.css"`, `"./standalone.css"`. `export function cn(...inputs: ClassValue[]): string` (clsx plus tailwind-merge).
- `shell.css` = layer order + preflight + `theme.css` + `tokens.css` + `@source` for itself. `remote.css` = layer order + `theme.css` + utilities only (no preflight, no tokens). `standalone.css` = `shell.css` content for local remote development.

- [ ] **Step 1: Write failing tests** in `src/tokens.test.ts` (read the CSS files as text):
  - every token in the Global Constraints list has a `--<token>:` declaration in `tokens.css` under `:root` and under `.dark`.
  - `theme.css` and `remote.css` contain no colour literals (no `#hex`, `rgb(`, `hsl(`, `oklch(`, `color-mix(` with literals) and `theme.css` maps every token via `--color-<token>: var(--<token>)` inside `@theme inline`.
  - `remote.css` does not import preflight or `tokens.css`.
  - `cn("p-2", false, "p-4")` equals `"p-4"`.
- [ ] **Step 2: Run** `pnpm --filter @poc/design-system test`. Expected: FAIL.
- [ ] **Step 3: Create the package and CSS files.** Dependencies: `tailwindcss`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react` only if a component needs an icon. `react`/`react-dom` as peer dependencies. Use the shadcn "neutral" palette (oklch values) for light and dark. Write `components.json` for the shadcn CLI (tailwind v4, css path `src/theme.css`, aliases pointing into this package).
- [ ] **Step 4: Run** the tests and `pnpm --filter @poc/design-system typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(design-system): tokens, theme mapping and cn helper`.

---

### Task 2: React components

**Files:**
- Create: `packages/design-system/src/components/{button,card,badge,alert,input,native-select,checkbox,breadcrumb,nav-link,definition-list}.tsx`, `src/components/components.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: `cn` (Task 1).
- Produces (named exports from `@poc/design-system`): `Button` (`variant?: "default"|"secondary"|"outline"|"ghost"|"destructive"`, `size?: "default"|"sm"`, plus all button attributes), `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge` (`variant?: "default"|"secondary"|"outline"|"warning"|"destructive"`), `Alert` (`variant?: "default"|"warning"|"destructive"`, `role="alert"` for non-default), `Input`, `NativeSelect` (renders `<select>`, forwards all attributes and children), `Checkbox` (renders `<input type="checkbox">`, forwards all attributes), `Breadcrumb`/`BreadcrumbItem`, `NavLink` (button-styled with `active?: boolean`, renders `<button>`), `DefinitionList` (`<dl>` with `dt`/`dd` children styled). Every component forwards `className` (merged via `cn`) and `data-*` attributes and `ref`.

- [ ] **Step 1: Write failing tests** (render with `react-dom/server` `renderToString`, no DOM needed): each component forwards `data-testid` and `className`; `NativeSelect` output starts with `<select`; `Checkbox` output contains `type="checkbox"`; `Button` `variant="destructive"` output contains the `bg-destructive` class and `variant="default"` contains `bg-primary`; `Alert variant="warning"` has `role="alert"`; `NavLink active` sets `aria-current="page"`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Generate the components** with the shadcn CLI where a registry item exists (button, card, badge, alert, input, breadcrumb), then adapt: `NativeSelect` and `Checkbox` are written by hand as styled native elements, `NavLink` and `DefinitionList` are hand-written. Keep Radix out of this package (no portals). Export everything from `src/index.ts`.
- [ ] **Step 4: Run** tests and typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(design-system): shadcn React components`.

---

### Task 3: `@poc/design-system-vue` components

**Files:**
- Create: `packages/design-system-vue/{package.json,tsconfig.json,vitest.config.ts,components.json}`, `src/components/*.vue` (same component names as Task 2, PascalCase), `src/index.ts`, `src/components.test.ts`

**Interfaces:**
- Consumes: `cn` from `@poc/design-system`.
- Produces (named exports): `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge`, `Alert`, `Input`, `NativeSelect`, `Checkbox`, `Breadcrumb`, `BreadcrumbItem`, `NavLink`, `DefinitionList` as Vue SFCs with the same variant props as the React versions. All use attribute inheritance (`inheritAttrs` default), so `data-testid`, `class`, `v-model` and `onChange` pass through to the root element. The package imports no CSS.

- [ ] **Step 1: Write failing tests** with `vue/server-renderer` (`renderToString` of `h(Component, props)`): each component keeps `data-testid` and extra `class`; `NativeSelect` renders `<select` and keeps its `<option>` children; `Checkbox` renders `type="checkbox"`; `Button` variants produce the same class names as the React `Button` for `default` and `destructive` (import the React class strings through a shared check of `bg-primary` / `bg-destructive`).
- [ ] **Step 2: Run** `pnpm --filter @poc/design-system-vue test`. Expected: FAIL.
- [ ] **Step 3: Generate or port** each component with shadcn-vue where an item exists, then adapt `NativeSelect`, `Checkbox`, `NavLink`, `DefinitionList` to native elements. No Reka UI portals in this package.
- [ ] **Step 4: Run** tests and typecheck (`vue-tsc` if the package uses it, else the repo's pattern). Expected: PASS.
- [ ] **Step 5: Commit** `feat(design-system-vue): shadcn-vue components`.

---

### Task 4: Tailwind in the three shells

**Files:**
- Modify: `apps/shell-{injected,federated,zustand}/{modern.config.ts,package.json}`, `packages/shell-ui/package.json` (depend on `@poc/design-system`)
- Create: `apps/shell-{injected,federated,zustand}/src/styles.css` (imports `@poc/design-system/shell.css` and adds `@source` for `packages/shell-ui`)
- Modify: each shell's entry so `styles.css` is imported once (the builder finds the entry; shells share `ShellApp`, so import it from the shell app entry, not from `shell-ui`).

**Interfaces:**
- Consumes: `shell.css` (Task 1), `Button` (Task 2).
- Produces: shells build CSS containing Tailwind utilities, `:root` and `.dark` token values, and preflight.

- [ ] **Step 1: Write the failing check** as a node script test or vitest file `apps/shell-injected/build.check.test.ts` that runs after `pnpm --filter @poc/shell-injected build` and reads `dist` CSS: it contains `--primary:` (token values), `.dark`, a utility `.bg-primary` or its compiled form, and a class that only appears inside `packages/design-system/src/components/button.tsx` (proves `@source` of the design-system package). If a test file under `dist` reading is awkward, a documented shell script `scripts/check-built-css.sh` run in the verification step is acceptable.
- [ ] **Step 2: Run** it. Expected: FAIL (no CSS yet).
- [ ] **Step 3: Wire `@tailwindcss/postcss`** through `tools.postcss` in each `modern.config.ts` (Modern.js 3) and add the CSS imports. Render one design-system `Button` temporarily in `ShellApp` only if needed to prove the class is detected; remove it before commit.
- [ ] **Step 4: Run** `pnpm typecheck`, `pnpm build`, and the check. Expected: PASS. Run `SHELL_A_URL=http://localhost:8090 pnpm test:e2e` with dev servers up: the 21 tests still pass (shell is unstyled apart from preflight, which must not break them).
- [ ] **Step 5: Commit** `build(shells): add Tailwind v4 and design-system CSS`.

---

### Task 5: Tailwind in both remotes, with CSS delivered through `mount`

**Files:**
- Modify: `apps/remote-react/{rsbuild.config.ts,package.json,src/mount.tsx}`, `apps/remote-vue/{rsbuild.config.ts,package.json,src/mount.ts}`
- Create: `apps/remote-{react,vue}/src/styles.css` (imports `@poc/design-system/remote.css`, adds `@source` for the app's own `src` and the component package), `apps/remote-react/build.check.test.ts` and `apps/remote-vue/build.check.test.ts` (or the shell-script alternative from Task 4)

**Interfaces:**
- Consumes: `remote.css` (Task 1).
- Produces: each remote's `./mount` module imports its `styles.css`, so the CSS is fetched when the shell loads the remote.

- [ ] **Step 1: Write failing checks.** Built-CSS check for each remote: the CSS contains utility rules and `var(--primary)`-style references, contains no colour literal for any token value from `tokens.css` and no preflight marker (for example the `*, ::before, ::after` reset or `box-sizing: border-box` base rule from preflight), and contains a class used only in the app's own components.
- [ ] **Step 2: Write a failing runtime proof** in `tests/e2e/specs/a-design.spec.ts` (new file, scenario 20): after login, a temporary token-based class on one element in each remote renders with the token colour (computed `background-color` equals the colour of `--primary` read via `getComputedStyle(document.documentElement)`). This proves remote CSS reaches the page when mounted through the shell. Keep it simple; Task 10 extends the file.
- [ ] **Step 3: Run** both. Expected: FAIL.
- [ ] **Step 4: Wire `@tailwindcss/postcss`** via `tools.postcss` in each Rsbuild config and import `./styles.css` from the exposed `mount` module. Verify the production build emits and the shell actually requests the remote CSS file when mounting; if Module Federation does not load it, fix it (for example the CSS extraction or the remote's `mf-manifest` assets) and write the finding into `docs/limitations.md` in Task 11. Add `standalone` usage for `pnpm --filter @poc/remote-react dev` so a remote opened alone still shows tokens (import `standalone.css` only when not mounted by a shell: for example in `bootstrap.tsx`/`bootstrap.ts`, which the shell never loads).
- [ ] **Step 5: Run** built-CSS checks, `pnpm typecheck`, `pnpm build`, then the e2e (scenario 20 and the 21 existing). Expected: PASS.
- [ ] **Step 6: Commit** `build(remotes): add Tailwind v4 and ship remote CSS with mount`.

---

### Task 6: Shell frame and theme toggle

**Files:**
- Create: `packages/shell-ui/src/ThemeToggle.tsx`
- Modify: `packages/shell-ui/src/{ShellApp,ShellChrome,RemoteHost}.tsx`

**Interfaces:**
- Consumes: `@poc/design-system` components.
- Produces: `ThemeToggle` (button, `data-testid="theme-toggle"`, `aria-pressed`) toggling `document.documentElement.classList` `dark`; default is light. Restyled app frame (top bar, nav with `NavLink`, main grid with two remote cards via `Card`, header and sidebar slot regions) keeping every existing test id.

- [ ] **Step 1: Write failing e2e** in `a-design.spec.ts`: scenario 21 `theme toggle switches the shell to dark`: click `theme-toggle`; `html` has class `dark`; the `body` computed `background-color` changes; click again and it returns. Scenario 22 `shell chrome keeps native controls`: `language-select` is a `select` element (`evaluate(el => el.tagName)`), `selectOption("th")` still works.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Restyle** `ShellApp`, `ShellChrome` and `RemoteHost` with Tailwind classes and design-system components; remove their inline styles. Add `ThemeToggle` to the top bar. `language-select` uses `NativeSelect`; nav buttons use `NavLink` with the same `data-testid`s; layout actions use `Button` keeping `shell-action-<id>`; the DI banner uses `Alert`.
- [ ] **Step 4: Run** the new scenarios and the existing 21 e2e (`SHELL_A_URL=http://localhost:8090`), `pnpm typecheck`, `pnpm build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shell-ui): themed app frame and theme toggle`.

---

### Task 7: Shell panels

**Files:**
- Modify: `packages/shell-ui/src/{SessionPanel,ScenarioControls,EventLog}.tsx`

**Interfaces:**
- Consumes: design-system components. Produces: panels with no inline styles; all existing test ids, button labels and text unchanged.

- [ ] **Step 1: Write failing check:** `grep -c "style={{" packages/shell-ui/src/*.tsx` must be 0 across `shell-ui` (add it as a lint-style vitest or a documented shell command in this step's verification), plus an e2e assertion in `a-design.spec.ts` scenario 23 `force-cleanup-fail is still a checkbox`: it is `input[type=checkbox]`, `isChecked()` toggles on click.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Restyle:** `SessionPanel` uses `Card` and `DefinitionList` (dt/dd keep their `data-testid`s), session buttons use `Button`; `ScenarioControls` uses `Checkbox` and `Button`; `EventLog` uses `Card` with a scrolling mono list, clear button `Button`.
- [ ] **Step 4: Run** the check, scenario 23, the full existing e2e, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shell-ui): themed session panel, controls and event log`.

---

### Task 8: React remote

**Files:**
- Modify: `apps/remote-react/src/{App,mount}.tsx`, `apps/remote-react/package.json` (depend on `@poc/design-system`)

**Interfaces:**
- Consumes: `Card`, `Button`, `Badge`, `Alert`, `Input`/textarea styling, `DefinitionList` if useful.
- Produces: styled orders list (`Card` list, `Badge` for status, `Button size="sm"` for Open with the same `data-testid`s), detail view, blocked and error states (`Alert`), header badge (`Badge`), the draft note field. All strings and test ids unchanged (`react-heading`, `react-order-open-<id>`, `react-order-detail`, `react-shell-user`).

- [ ] **Step 1: Write failing e2e** in `a-design.spec.ts`: scenario 24 `react remote uses tokens`: after login the React `Open` button has the same computed `background-color` and `border-radius` as the shell's primary `Button` (for example `shell-action-refresh` after opening an order, or the `login` button); the header slot badge text colour equals the `--primary-foreground`-based or border colour expected for `Badge` (assert it changes when `theme-toggle` is on).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Restyle** the remote and its header slot component (`OpenOrdersBadge`) with design-system components. Slot content must use classes only (no inline colour).
- [ ] **Step 4: Run** scenario 24, existing e2e, typecheck, build. Expected: PASS.
- [ ] **Step 5: Commit** `feat(remote-react): apply design system`.

---

### Task 9: Vue remote

**Files:**
- Modify: `apps/remote-vue/src/{App,SidebarCard}.vue`, `apps/remote-vue/package.json` (depend on `@poc/design-system-vue`)

**Interfaces:**
- Consumes: Vue `Card`, `Alert`, `NativeSelect`, `DefinitionList`, `Badge`.
- Produces: styled summary view and sidebar card; `vue-language-picker` stays a native `<select>` with options `en`/`th`; test ids (`vue-heading`, `vue-shell-user`, `vue-sidebar-card`, `vue-sidebar-account`, `vue-language-picker`) and strings unchanged.

- [ ] **Step 1: Write failing e2e** in `a-design.spec.ts`: scenario 25 `vue remote follows the shell theme`: computed `background-color` of `vue-sidebar-card` and of the Vue summary container changes when `theme-toggle` is on and returns when it is off, and `vue-language-picker` is a `select` that still accepts `selectOption("th")`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Restyle** the Vue remote and sidebar card with `@poc/design-system-vue` components; no scoped colour values.
- [ ] **Step 4: Run** scenario 25, existing e2e, typecheck, build. Expected: PASS.
- [ ] **Step 5: Commit** `feat(remote-vue): apply design system`.

---

### Task 10: Cross-app e2e and B/C smoke

**Files:**
- Modify: `tests/e2e/specs/a-design.spec.ts`, `tests/e2e/page-objects/ShellPage.ts` (add `themeToggle()`, `computed(locator, property)` helper), `tests/e2e/specs/bc-smoke.spec.ts`

**Interfaces:** consumes the test ids from Tasks 6 to 9.

- [ ] **Step 1: Write the final scenarios** (replace the Task 5 temporary proof with a real one): scenario 26 `slot content follows the theme`: header and sidebar slot computed text colour and card background change with `theme-toggle` (React header badge and Vue sidebar card), proving slots inherit shell variables; scenario 27 `theme survives account switch`: toggle dark, switch to South, remotes and slots still dark (computed background unchanged from dark) after the transition finishes; scenario 28 `token consistency`: React Open button, Vue picker border colour and shell primary button agree on the `--radius`-derived `border-radius` where they share a component size.
- [ ] **Step 2: B/C smoke:** after login assert `theme-toggle` is visible and `slot-header` still contains `Open orders`.
- [ ] **Step 3: Run** the full suite with A, B and C up: `SHELL_A_URL=http://localhost:8090 SHELL_B_URL=http://localhost:8091 SHELL_C_URL=http://localhost:8092 pnpm test:e2e`. Expected: all pass, 0 skipped. Run `a-design.spec.ts` twice for flakiness.
- [ ] **Step 4: Commit** `test(e2e): design system and theming scenarios`.

---

### Task 11: Docs and full verification

**Files:**
- Create: `docs/design-system.md`
- Modify: `AGENTS.md`, `docs/limitations.md`, `README.md`

- [ ] **Step 1: Write the docs** per spec 5.7: ownership line (shell owns token values; remotes own their Tailwind build and may import the design-system packages for UI only), remote rules (semantic tokens only, no colour values, no preflight, native controls stay native where e2e depends on them, import `styles.css` from the exposed `mount` module), updated "Adding a remote" checklist; limitations (duplicate utility CSS across bundles, version skew of component code with only variables shared, no CSS isolation in the same realm, two component sets to keep in sync, any federated-CSS finding from Task 5); `docs/design-system.md` (packages, token list, how to add a component in React and Vue, how a remote adopts it); README package list and scenarios 20 to 28 with real numbers after the run below.
- [ ] **Step 2: Run the full set:** `pnpm install && pnpm typecheck && pnpm test:unit && pnpm build`, then the three-shell e2e from Task 10. Expected: all pass, 0 skipped. Stop dev servers; revert regenerated tracked `@mf-types` files.
- [ ] **Step 3: Commit** `docs: design system guide, rules and limitations`.

---

## Self-Review

- **Spec coverage:** packages and components (Tasks 1 to 3), CSS split and build wiring (Tasks 1, 4, 5), runtime theming and toggle (Task 6), apply to shell-ui, React and Vue remotes including slots (Tasks 6 to 9), tests (Tasks 1 to 5 checks, 5 to 10 e2e, built-CSS guard in 4 and 5), docs and `AGENTS.md` dependency-rule change (Task 11). The artifact update is out of scope as stated in the spec.
- **Type consistency:** component names and variant props defined in Tasks 2 and 3 are used with the same names in Tasks 6 to 9. CSS entry names (`shell.css`, `remote.css`, `standalone.css`, `theme.css`, `tokens.css`) are defined in Task 1 and used in Tasks 4 and 5.
- **Known weak spots:** federated CSS delivery with Module Federation is the least certain step (Task 5 allows a fix and a documented finding). The shadcn CLI needs network access. Built-CSS checks depend on the compiled form of Tailwind utilities; the builder pins the assertion to the output it observes.
