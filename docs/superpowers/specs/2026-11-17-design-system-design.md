# Design System: Tailwind and shadcn Across Shell and Remotes

**Status:** Draft for user review
**Date:** 2026-11-17
**Type:** POC extension. Builds on the session design (2026-11-14) and the shell API design (2026-11-16, PR #2).

## 1. Intent

The shell, the React remote and the Vue remote currently have no shared look. The shell uses about 30 inline `style={{}}` blocks, the React remote is unstyled markup, and the Vue remote has no styles. The owner wants a **consistent look** across all of them.

The design system has to work for independently built and deployed remotes that render into one page (including the shell's header and sidebar slots), in two frameworks (React and Vue), built by two different bundlers (Modern.js for shells, Rsbuild for remotes).

## 2. Goals, non-goals, anti-goals

**Goals**
- A shared library with Tailwind v4 design tokens and a small set of shadcn components for React, plus the same components for Vue (shadcn-vue), reading the same tokens.
- **The shell owns the values.** Colour, radius and typography values are defined once, in the shell, as CSS variables. Remotes reference variables only, so a change in the shell restyles every remote without rebuilding it.
- Apply it to everything visible: all of `@poc/shell-ui` (so shells A, B and C), the React remote (list, detail, header slot badge), and the Vue remote (summary, sidebar slot card, language picker).
- A light and dark theme, switched in the shell, to prove remotes follow the shell at runtime without any API call.
- A short adoption doc: how a new remote joins the design system.

**Non-goals**
- Brand or visual exploration. One neutral shadcn-style theme is enough.
- A full component catalog, Storybook, icon sets beyond what the app needs, animation work.
- SSR, theming API in `ShellApi`, per-remote theme overrides.
- Replacing or loosening the existing e2e tests.

**Anti-goals (failure even if it looks good)**
- A remote defines its own colour values, so a shell theme change does not reach it.
- Tailwind's global reset or class names from one app restyling another app's DOM.
- Utility classes missing at runtime because the shell build could not see a remote's classes.
- Any existing `data-testid`, English string or native control behavior changing, so the 21 e2e tests no longer pass as written.
- The shell importing remote code, or a remote importing shell internals, to share styles.

## 3. Constraints

- Tailwind **v4** (CSS-first `@theme`, `@tailwindcss/postcss`, current 4.3.x). shadcn CLI 4.x for React, shadcn-vue 2.x (Reka UI) for Vue. Versions are pinned in the lockfile; the builder re-checks the registry before locking.
- Shells are Modern.js 3 (rspack) and remotes are Rsbuild 2. Both must run Tailwind through PostCSS (`@tailwindcss/postcss`). The old `@modern-js/plugin-tailwindcss` is Modern.js 2 and is not used.
- shadcn components are **copied into the repo** (shadcn's model), not installed as a library. Generating them needs the shadcn CLI and network access.
- React is a Module Federation shared singleton (`eager` in the shell). The design-system React package must not bring its own React. The Vue remote bundles its own Vue.
- `@poc/platform-contracts` is not federated, and the design-system packages are not either. Each app bundles its own copy of component code, so **component code must carry no state and no shared runtime identity**. Only CSS variables are shared at runtime.
- **Native controls stay native.** The existing e2e tests call `selectOption` on `language-select` and `vue-language-picker`, and `isChecked`/`click` on `force-cleanup-fail`. So Select and Checkbox are styled native elements, not Radix or Reka portals.
- All existing `data-testid`s and English strings stay unchanged.
- `AGENTS.md` currently says remotes depend only on `@poc/platform-contracts`. This design adds a second allowed dependency for remotes, the UI-only design-system package, and `AGENTS.md` is updated to say so (see 5.7).

## 4. Approaches considered

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **1. Shell owns variable values, each app builds its own Tailwind CSS from a shared theme** | Consistent at runtime, remotes stay independently deployable. Two component sets (React, Vue) to keep in sync. Duplicate utility CSS across bundles (identical rules, harmless). | **Chosen** |
| 2. Shell serves all CSS, remotes ship none | Tailwind scans for class names at build time. The shell build cannot see classes a remote uses, so styles go missing. | Rejected |
| 3. Web components or shadow DOM per remote | Strongest isolation, but fights Tailwind and shadcn and breaks the slot rendering from the shell API work. | Rejected |

Within approach 1, Vue gets full component parity with shadcn-vue (rather than tokens only). That was proposed by me and not contested by the owner.

## 5. Design

### 5.1 Packages

| Package | Contents | Used by |
| --- | --- | --- |
| `@poc/design-system` | Tailwind theme and tokens CSS, the `cn()` helper, shadcn React components, `components.json` | shell-ui, remote-react |
| `@poc/design-system-vue` | shadcn-vue components, its own `components.json`, imports the same theme CSS from `@poc/design-system` | remote-vue |

Components in scope (only what the app uses): Button, Card, Badge, Alert, Input, native Select, native Checkbox, Breadcrumb, a nav (Tabs-like link list), and a Table or definition list for the session panel. The builder trims the list to what the restyled screens actually need.

### 5.2 CSS split: values vs mapping

- `theme.css` (imported by **every** app): the Tailwind v4 `@theme inline { --color-primary: var(--primary); ... }` mapping, so utilities like `bg-primary` compile to `var(--primary)`. It contains **no values**.
- `tokens.css` (imported by the **shell only**): the actual values on `:root` and `.dark` (background, foreground, primary, muted, border, ring, destructive, radius, font family).
- Base reset (Tailwind preflight) is imported by the shell only. Remotes use utilities, not preflight, so they cannot restyle the shell page.
- `standalone.css` (builder's choice of name): tokens plus preflight for running a remote alone on its own port during development. Not part of the federated production path.

### 5.3 Build wiring

- Each app (shell A, B, C, remote-react, remote-vue) adds `@tailwindcss/postcss` through its bundler's PostCSS config and imports its own CSS entry. Tailwind v4 detects sources automatically; each remote's `@source` covers its own `src` and the design-system package, and the shell's `@source` covers `shell-ui` and the design-system package.
- A remote's CSS is loaded by the remote's own entry, so it arrives with `mount` through Module Federation. The builder verifies the CSS is actually requested when the remote mounts into the shell (a known gotcha with federated CSS) and documents the result.
- Cascade layer order matches across apps (theme, base, components, utilities) so duplicate utilities cannot override each other.

### 5.4 Theming at runtime

- The shell toggles a `dark` class on `<html>`. Because remotes read only CSS variables, they change with it.
- A light/dark switch is added to the shell top bar (`data-testid="theme-toggle"`). It is a shell feature only: no new `ShellApi` field and no contract change. The choice is kept in memory, not persisted.

### 5.5 Applying it

- **`@poc/shell-ui`:** replace all inline styles with Tailwind classes and design-system components in `ShellApp`, `ShellChrome`, `SessionPanel`, `RemoteHost`, `ScenarioControls`, `EventLog`. The page gets a real app frame: top bar, nav, main area with the two remote cards, sidebar and header slot regions styled so slot content looks native.
- **React remote:** order list and detail, buttons, the header badge, blocked and error states.
- **Vue remote:** summary view, blocked and error states, sidebar card and language picker.
- Existing `data-testid`s, English strings, element types (`select`, `input[type=checkbox]`, buttons) and DOM nesting that the page objects rely on are preserved.

### 5.6 Testing

- Existing unit tests and all 21 e2e tests pass unchanged.
- New e2e scenarios on shell A:
  - Theme: toggling `theme-toggle` changes the computed background colour of the shell **and** of a React remote element **and** a Vue remote element (proves runtime variables reach both remotes), and returns on toggle back.
  - Token consistency: the React "Open" button and the shell's primary button have the same computed `background-color` and `border-radius`; the Vue sidebar primary action matches too.
  - Slots: header and sidebar slot content inherits the theme (computed colour check).
- Unit or build-level check that a remote's built CSS contains no raw colour values for the theme tokens (grep the built CSS for the token values from `tokens.css`). This guards the "remotes reference variables only" rule.
- B and C smoke additionally assert the themed shell renders (e.g. `theme-toggle` visible).
- `pnpm typecheck`, `pnpm test:unit`, `pnpm build` pass.

### 5.7 Documentation

- `AGENTS.md`: ownership line (shell owns token values; remotes own their own Tailwind build and may import `@poc/design-system` or `@poc/design-system-vue` for UI only), remote rules (no colour values, no preflight, use semantic tokens, keep native controls native where e2e depends on them), updated "Adding a remote" checklist.
- `docs/limitations.md`: duplicate utility CSS across bundles, version skew of component code between independently deployed remotes (only CSS variables are shared), same-realm CSS has no isolation, two component sets to keep in sync.
- `docs/design-system.md` (new, short): packages, token list, how to add a component in React and Vue, how a new remote adopts it.
- The architecture artifact is updated in a separate step after this lands.

## 6. Decisions I made (the owner can overrule)

- Tailwind v4 with `@tailwindcss/postcss`, not v3.
- Two packages, `@poc/design-system` and `@poc/design-system-vue`, both under `packages/`.
- Values live only in the shell (`tokens.css`); remotes get the variable mapping only.
- Preflight is shell-only.
- Selects and checkboxes are styled native elements to keep the e2e tests valid.
- A light/dark toggle in the shell, in memory, no `ShellApi` change.
- Remotes may depend on the design-system packages (an addition to the `AGENTS.md` dependency rule).
- This work is branched from the shell API branch (`feat/shell-api-layout`, PR #2), because it restyles the same files. It becomes a stacked PR.
- One neutral shadcn theme (default "neutral" palette), no brand colours.

## 7. Left to the builder

- Exact token values, radii, font stack, spacing scale.
- Which components to generate, within 5.1, and their exact variants.
- File names for the CSS entries and the standalone variant.
- How each bundler's PostCSS wiring is expressed, and the fix if federated CSS does not load with `mount`.
- The visual layout of the app frame, within 5.5.
