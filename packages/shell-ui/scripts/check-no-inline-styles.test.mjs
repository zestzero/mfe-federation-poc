import assert from "node:assert/strict";
import { test } from "node:test";
import { findInlineStyles } from "./check-no-inline-styles.mjs";

const bypasses = {
  "object literal": `<div style={{ color: "red" }} />`,
  "variable": `<div style={someVar} />`,
  "styles object": `<div style={styles} />`,
  "spaces around =": `<div style = {{ color: "red" }} />`,
  "space inside brace": `<div style={ {color: "red"} } />`,
  "newline after =": `<div style=\n{{ color: "red" }} />`,
  "string style": `<div style="color:red" />`,
  "single-quoted": `<div style='color:red' />`,
  "spread with style key": `<div {...{ style: { color: "red" } }} />`,
  "spread props object": `const p = { style: x }; <div {...p} />`,
};

for (const [name, src] of Object.entries(bypasses)) {
  test(`detects ${name}`, () => assert.equal(findInlineStyles(src).length >= 1, true, src));
}

test("reports the line of a multi-line hit", () => {
  assert.match(findInlineStyles(`<a>\n<b\n  style\n  ={{}} />`)[0], /:3:/);
});

test("clean file passes", () => {
  const clean = `export const A = () => <div className="p-4 text-sm" data-styled="x">{"hello"}</div>;`;
  assert.deepEqual(findInlineStyles(clean), []);
});
