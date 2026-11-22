#!/usr/bin/env node
// Usage: node check-built-css.mjs <distDir>                       (shell build)
//        node check-built-css.mjs <distDir> --remote <class>...   (remote build)
// Shell: asserts the build emitted the design-system CSS: token values, dark tokens, preflight,
// a utility, a class used only in packages/design-system (its @source) and one used only in
// packages/shell-ui (the shell's @source).
// Remote: asserts utilities, the design-system class (.outline-hidden) and var(--…) references, no token value, no raw colour literal outside
// Tailwind's engine internals, no preflight, and each <class> (used only in sources the remote's
// @source must cover) compiled.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dist, mode, ...classes] = process.argv.slice(2);
if (!dist || (mode && mode !== "--remote")) {
  throw new Error("usage: check-built-css.mjs <distDir> [--remote <class>...]");
}

// Remote: only the CSS Module Federation ships with the `./mount` expose (the standalone dev entry
// has its own CSS with tokens and preflight, which the shell never loads).
const files = mode
  ? (() => {
      const manifest = JSON.parse(readFileSync(join(dist, "mf-manifest.json"), "utf8"));
      const css = manifest.exposes.find((e) => e.path === "./mount")?.assets.css;
      return css ? [...css.sync, ...css.async] : [];
    })()
  : readdirSync(dist, { recursive: true }).map(String).filter((f) => f.endsWith(".css"));
if (mode) console.log(`./mount CSS in mf-manifest.json: ${files.join(", ") || "(none)"}`);
const css = files.map((f) => readFileSync(join(dist, f), "utf8")).join("\n");

// Same regex and engine-internals stripping as packages/design-system/src/tokens.test.ts.
const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(|color-mix\([^)]*(#|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\()|:[^;{}]*\b(white|black|red|blue)\b\s*[;}]/;
// The production minifier also rewrites the keyword `transparent` to `#0000`, the same colour;
// turn it back so only real colour values count as literals.
const engineInternals = (s) =>
  s
    .replace(/@property[^{]*\{[^}]*\}/g, "")
    .replace(/@supports[^{]*\{\s*\*[^{]*\{[^}]*\}\s*\}/g, "")
    .replace(/#0000(0000)?\b/gi, "transparent");
// Token names from tokens.css. The minifier rewrites token values (oklch -> hex + lab fallback), so
// a value string match would miss them; a remote must not declare a token at all, and any value it
// could carry is a colour literal caught below.
const tokenNames = [
  ...new Set(
    [...readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8").matchAll(/(--[\w-]+):/g)].map((m) => m[1]),
  ),
];

const has = (s) => (s instanceof RegExp ? s.test(css) : css.includes(s));
const checks = mode
  ? [
      ["utility rule (.text-foreground{color:var(--…))", has(/\.text-foreground\s*\{\s*color:\s*var\(--/)],
      ["var(--…) references", has("var(--")],
      // Proves remote.css's @source still covers packages/design-system: the shell's same-realm CSS
      // would otherwise mask a remote that silently lost the component classes.
      ["design-system class (.outline-hidden)", has(/\.outline-hidden\s*\{/)],
      ...tokenNames.map((n) => [`no token declaration ${n}:`, !new RegExp(`(^|[^\\w-])${n}\\s*:`).test(css)]),
      ["no raw colour literal (outside @property / @supports internals)", !LITERAL.test(engineInternals(css))],
      ["no preflight (-webkit-text-size-adjust)", !has("-webkit-text-size-adjust")],
      ...classes.map((c) => [`source-only class (${c})`, has(new RegExp(`\\${c}\\s*\\{`))]),
    ]
  : [
      ["token values (--primary:)", has("--primary:")],
      ["dark token values (.dark { --primary: })", has(/\.dark\s*\{[^}]*--primary:/)],
      ["preflight (-webkit-text-size-adjust)", has("-webkit-text-size-adjust")],
      ["utility (.bg-primary)", has(".bg-primary")],
      ["design-system-only class (.outline-hidden)", has(".outline-hidden")],
      ["shell-ui-only class (.antialiased)", has(".antialiased")],
    ];

if (!css) checks.unshift(["any .css emitted", false]);
for (const [label, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`check:css FAILED in ${dist}: ${failed.map(([l]) => l).join(", ")}`);
  process.exit(1);
}
console.log(`check:css passed (${dist})`);
