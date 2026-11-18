import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";
import { cn } from "./lib/utils";

const css = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");

const TOKENS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted",
  "muted-foreground", "accent", "accent-foreground", "destructive", "destructive-foreground",
  "warning", "warning-foreground", "border", "input", "ring",
];
const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(|color-mix\([^)]*(#|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\()|:[^;{}]*\b(white|black|red|blue)\b\s*[;}]/;
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const block = (s: string, sel: string) => {
  const i = s.indexOf(sel + " {");
  return i < 0 ? "" : s.slice(i, s.indexOf("}", i));
};

// Every var(--x) the @theme inline mapping reads must have a value in tokens.css: under :root, and
// under .dark too, except --radius (not themed per scheme). Derived from theme.css so a new mapping
// without a value fails; the TOKENS list below stays as an independent check that the mapping lists all.
const missingTokens = (theme: string, tokens: string) => {
  const names = [...new Set([...theme.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]))];
  return names.flatMap((n) =>
    [":root", ...(n === "radius" ? [] : [".dark"])]
      .filter((sel) => !new RegExp(`--${n}:`).test(block(tokens, sel)))
      .map((sel) => `${sel} --${n}`),
  );
};

describe("tokens.css", () => {
  it("declares every var() that theme.css maps (derived from theme.css)", () => {
    expect(missingTokens(stripComments(css("theme.css")), css("tokens.css"))).toEqual([]);
  });
  it("missingTokens detects an undeclared var in a fixture", () => {
    const tokens = ":root { --a: 1; --radius: 1; }\n.dark { --a: 2; }";
    expect(missingTokens("@theme inline { --color-a: var(--a); --radius-md: calc(var(--radius) - 2px); }", tokens)).toEqual([]);
    expect(missingTokens("@theme inline { --color-info: var(--info); --color-a: var(--a); }", tokens)).toEqual([
      ":root --info",
      ".dark --info",
    ]);
    expect(missingTokens("@theme inline { --color-a: var(--a); }", ":root { --a: 1; }")).toEqual([".dark --a"]);
  });
  const t = css("tokens.css");
  it("colour-literal regex fires on tokens.css", () => {
    expect(t).toMatch(LITERAL);
    expect("a { color: white; }").toMatch(LITERAL);
    // transparent is a keyword, not a theme colour
    expect("a { color: transparent; }").not.toMatch(LITERAL);
    expect("a { x: color-mix(in oklab, #fff 10%, red); }").toMatch(LITERAL);
  });
  for (const sel of [":root", ".dark"]) {
    it(`declares every token and radius under ${sel}`, () => {
      const b = block(t, sel);
      for (const n of [...TOKENS, "shadow-color"]) expect(b, n).toMatch(new RegExp(`--${n}:`));
      if (sel === ":root") expect(b).toMatch(/--radius:/);
    });
  }
});

describe("theme.css / remote.css", () => {
  const theme = stripComments(css("theme.css"));
  const remote = stripComments(css("remote.css"));
  it("have no colour literals", () => {
    expect(theme).not.toMatch(LITERAL);
    expect(remote).not.toMatch(LITERAL);
  });
  it("theme maps every token inside @theme inline", () => {
    expect(theme).toContain("@theme inline");
    for (const n of TOKENS) expect(theme).toContain(`--color-${n}: var(--${n});`);
  });
  it("remote imports neither preflight nor tokens", () => {
    expect(remote).not.toMatch(/preflight|tokens\.css/);
    expect(remote).toContain("theme.css");
  });
  it("shell has preflight, theme, tokens", () => {
    const shell = css("shell.css");
    expect(shell).toMatch(/preflight/);
    expect(shell).toContain("./theme.css");
    expect(shell).toContain("./tokens.css");
  });
});

describe("scripts/check-built-css.mjs", () => {
  it("uses the same colour-literal regex and engine-internals stripping as this file", () => {
    const script = readFileSync(new URL("../scripts/check-built-css.mjs", import.meta.url), "utf8");
    expect(script).toContain(LITERAL.toString());
    for (const re of [/@property[^{]*\{[^}]*\}/g, /@supports[^{]*\{\s*\*[^{]*\{[^}]*\}\s*\}/g])
      expect(script).toContain(`.replace(${re.toString()}, "")`);
  });
});

describe("cn", () => {
  it("merges conflicting classes", () => {
    expect(cn("p-2", false, "p-4")).toBe("p-4");
  });
});

const dir = fileURLToPath(new URL("./", import.meta.url));
const FIXTURE =
  "shadow-xs shadow-sm shadow-md bg-primary bg-card text-foreground border ring-1 ring-ring rounded-md bg-white text-black shadow-2xl drop-shadow-md inset-shadow-sm text-shadow-sm";
// Tailwind's own `@property` initial values and its old-browser `@supports` fallback hold `#0000`
// (transparent zero shadows) and `#fff` (ring-offset-color, unused at 0 offset). They are engine
// internals, not theme colours, so they are excluded from the literal check.
const engineInternals = (css: string) =>
  css
    .replace(/@property[^{]*\{[^}]*\}/g, "")
    .replace(/@supports[^{]*\{\s*\*[^{]*\{[^}]*\}\s*\}/g, "");
const compile = async (entry: string, inline = "") => {
  const from = dir + "__fixture.css";
  const src = `@import "./${entry}";\n${inline ? `@source inline("${inline}");` : ""}`;
  return (await postcss([tailwind()]).process(src, { from })).css;
};

describe("compiled output", () => {
  it("remote.css emits no colour literals or preflight, and uses variables", async () => {
    const out = await compile("remote.css", FIXTURE);
    expect(out).toContain(".shadow-sm");
    expect(out).toContain(".shadow-xs");
    expect(out).toContain(".ring-ring");
    expect(out).toContain(".text-foreground");
    expect(out).toMatch(/\.bg-primary\s*{\s*background-color:\s*var\(--primary\)/);
    expect(engineInternals(out)).not.toMatch(LITERAL);
    expect(out).not.toContain("-webkit-text-size-adjust") // preflight marker; box-border utility is fine;
  });
  it("scans component sources: their classes compile and add no colour literals", async () => {
    const out = await compile("remote.css");
    for (const c of [".bg-primary", ".bg-destructive", ".bg-warning", ".accent-primary", ".border-border", ".text-muted-foreground"])
      expect(out, c).toContain(c);
    expect(engineInternals(out)).not.toMatch(LITERAL);
  });
  it("compiled remote.css has the border/background resets and a solid border without preflight", async () => {
    const out = await compile("remote.css");
    expect(out).toMatch(/\.border-0\s*{[^}]*border-width:\s*0px/);
    expect(out).toMatch(/\.bg-transparent\s*{\s*background-color:\s*transparent/);
    expect(out).toMatch(/\.border-solid\s*{[^}]*border-style:\s*solid/);
    expect(out).toMatch(/@property --tw-border-style\s*{[^}]*initial-value:\s*solid/);
  });
  it("reset shadow namespaces emit nothing (shadow-2xl, inset-shadow-sm, text-shadow-sm)", async () => {
    const out = await compile("remote.css", FIXTURE);
    for (const c of [".shadow-2xl", ".inset-shadow-sm", ".text-shadow-sm", ".bg-white", ".text-black"])
      expect(out, c).not.toContain(c);
  });
  it("shell.css emits token values and preflight (proves the checks fire)", async () => {
    const out = await compile("shell.css", FIXTURE);
    expect(out).toMatch(/oklch\(/);
    expect(out).toMatch(LITERAL);
    expect(out).toContain("-webkit-text-size-adjust");
  });
  it("entries do not pick up stray utilities from test files", async () => {
    for (const e of ["remote.css", "shell.css"]) {
      const out = await compile(e);
      // Only classes that exist solely in tokens.test.ts; real components legitimately use .border etc.
      for (const c of [".p-2", ".p-4"])
        expect(out, `${e} ${c}`).not.toMatch(new RegExp(`${c.replace(".", "\\.")}\\s*{`));
    }
  });
});
