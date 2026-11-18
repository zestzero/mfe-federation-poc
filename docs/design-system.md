# Design system

Neutral shadcn theme (Tailwind v4, oklch tokens, light and dark). The shell owns the token values; every app builds its own utility CSS from a shared mapping.

## Packages

| Package | Exports |
| --- | --- |
| `@poc/design-system` | `.` (`cn`, React components: Alert, Badge, Breadcrumb, BreadcrumbItem, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, DefinitionList, Input, NativeSelect, NavLink), `./utils` (`cn`), `./variants` (class strings and cva variants shared by React and Vue), `./theme.css`, `./tokens.css`, `./shell.css`, `./remote.css`, `./standalone.css` |
| `@poc/design-system-vue` | The same 14 components as Vue SFCs. Classes come from `@poc/design-system/variants`. |

CSS entries:

- `theme.css`: `@theme inline` mapping (`--color-primary: var(--primary)` etc.), the `dark` custom variant, shadow scale built from `--shadow-color`. No values. Resets Tailwind's colour and shadow namespaces so no literal ships.
- `tokens.css`: token values (`:root` and `.dark`). Shell only.
- `shell.css`: layer order, Tailwind theme, preflight, `theme.css`, `tokens.css`, body background and colour. Imported by the shells.
- `remote.css`: layer order, Tailwind theme, utilities, `theme.css`, `@source` for the design-system components. No preflight, no values. Imported by remotes.
- `standalone.css`: `shell.css` again, for running a remote alone in development. Never loaded by the shell.

## Tokens

Names only; values are in `packages/design-system/src/tokens.css`.

`--radius`, `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--warning`, `--warning-foreground`, `--border`, `--input`, `--ring`, `--shadow-color`.

## Who owns what

- Shell: token values, `.dark` values, preflight, the theme toggle.
- Remotes: their own Tailwind build (from `remote.css`), component code, their own CSS file shipped with `./mount`.
- Remotes use utilities such as `bg-primary` that compile to `var(--primary)`, so they follow whatever the shell defines at runtime.

## Runtime theming

The shell's `theme-toggle` adds or removes the `dark` class on `<html>` (in memory, not persisted). `.dark` redefines the variables, so shell and remotes repaint together. There is no `ShellApi` field for the theme and remotes do not subscribe to anything.

## Add a component (React)

1. `pnpm dlx shadcn@latest add <name>` in `packages/design-system` (`components.json` is there). Needs network.
2. Adapt the output: semantic tokens only (no colour literals), no Radix and no portals, keep native controls native (`select`, `input[type=checkbox]`) where e2e depends on them.
3. Put the class strings and variants in `src/variants.ts` and import them in the component.
4. Export it from `src/index.ts` and add a test in `src/components/components.test.tsx`.

## Add a component (Vue)

1. Port the shadcn-vue version into `packages/design-system-vue/src/components/<Name>.vue`.
2. Take classes from `@poc/design-system/variants`; do not write a second class string. This keeps React and Vue identical.
3. Components are controlled natives (props and events, no `v-model`).
4. Export it from `src/index.ts`. `src/components.test.ts` holds the parity tests (rendered Vue classes equal the shared strings) and a type-level drift test (Vue props must match the variants); extend them.

## Adopt the design system in a new remote

1. Depend on `@poc/design-system` (and `@poc/design-system-vue` for Vue), plus `tailwindcss` and `@tailwindcss/postcss` at the same version as the other apps.
2. `src/styles.css`: `@import "@poc/design-system/remote.css";` and `@source "./";` (for Vue also `@source` for `packages/design-system-vue/src`, excluding tests).
3. `rsbuild.config.ts`: `tools.postcss` with `addPlugins(tailwindcss())`. React remotes that consume the React components also need `tools.swc.jsc.transform.react.runtime = "automatic"`.
4. `import "./styles.css"` at the top of the exposed `mount` module. Module Federation then lists the CSS under `exposes[./mount].assets.css` in `mf-manifest.json` and the shell's runtime injects the `<link>`. No shell change is needed.
5. Import `@poc/design-system/standalone.css` from the bootstrap (standalone entry) only, never from `mount`.
6. No colour values, no preflight, no token declarations in remote CSS.
7. If the remote's own utilities need a runtime proof, use a class that appears in no other app's source (React uses `tabular-nums`, Vue `slashed-zero`) and pass it to `check:css --remote`.
8. Add `"check:css": "node ../../packages/design-system/scripts/check-built-css.mjs dist --remote <class>"` to the remote's `package.json`.

## Guards

- `pnpm check:css` (root; all apps; last step of `pnpm ci`) or `pnpm --filter <app> check:css` (run after `pnpm build`; it reads `dist`): `check-built-css.mjs`.
  - Shell mode: token values, dark tokens, preflight, a utility, and classes from `packages/design-system` and `packages/shell-ui` compiled.
  - `--remote <class>...` mode: reads only the CSS listed for `./mount` in `mf-manifest.json`. Asserts utilities, a design-system class (`.outline-hidden`, proving `remote.css`'s `@source` still covers `packages/design-system`, which the shell's same-realm CSS would otherwise mask), `var(--)` references, no token declaration, no raw colour literal (engine-internal `@property` and `@supports` blocks are stripped first), no preflight, each `<class>` compiled, and a non-empty CSS list.
- `pnpm --filter @poc/shell-ui check:styles`: fails on any inline `style` in shell-ui source. Also runs as part of that package's `typecheck`.
- Compiled-output and token tests: `packages/design-system/src/tokens.test.ts` (no literals in `theme.css`/`remote.css`; every `var(--x)` mapped in `theme.css` is declared in `tokens.css` under `:root` and `.dark`; compiled `remote.css`, built against design-system sources only, has no literal and no preflight; the script's regexes match the test's). Token-declaration absence in remotes' real bundles, and remotes' own sources, are covered only by `check:css`, `components.test.tsx` (React) and `components.test.ts` (Vue).
