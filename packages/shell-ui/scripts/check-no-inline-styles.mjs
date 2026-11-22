// Fails if any shell-ui source still carries an inline style (styling goes through Tailwind / design-system).
// Strict on purpose: matches the whole file text (so split-across-lines forms count), and ignores no comments or
// strings, so a `style=` mentioned in a comment is a false positive: reword the comment.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `style=` + {, " or ' (any whitespace/newlines around `=`), and a `style:` object key (spread props).
const PATTERNS = [/\bstyle\s*=\s*[{"']/g, /\bstyle\s*:/g];

/** Returns "file:line: text" for every inline-style match in `text`. */
export function findInlineStyles(text, file = "<input>") {
  const hits = [];
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const line = text.slice(0, m.index).split("\n").length;
      hits.push({ line, msg: `${file}:${line}: ${text.split("\n")[line - 1].trim()}` });
    }
  }
  return hits.sort((a, b) => a.line - b.line).map((h) => h.msg);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.[jt]sx?$/.test(entry.name)) yield path;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const hits = [...walk(join(root, "src"))].flatMap((f) =>
    findInlineStyles(readFileSync(f, "utf8"), f.slice(root.length)),
  );
  if (hits.length) {
    console.error(`${hits.length} inline style(s) found:\n${hits.join("\n")}`);
    process.exit(1);
  }
  console.log("check:styles ok (no inline styles)");
}
