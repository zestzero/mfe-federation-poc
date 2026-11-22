import { describe, expect, it } from "vitest";
import {
  ShellCommandError,
  assertLanguage,
  assertPath,
  validateLayoutSpec,
  type LayoutSpec,
} from "./index";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ShellCommandError).code;
  }
  return undefined;
};
const action = (i: number) => ({ id: `a${i}`, label: `A${i}`, onSelect: () => {} });
const crumb = (i: number) => ({ label: `C${i}`, path: `/c${i}` });
const n = <T,>(len: number, f: (i: number) => T) => Array.from({ length: len }, (_, i) => f(i));

describe("assertPath", () => {
  it("accepts a valid path", () => {
    expect(assertPath("/orders/ord_1")).toBe("/orders/ord_1");
  });
  it.each(["orders", "/Orders", "/a b"])("rejects %s", (p) => {
    expect(code(() => assertPath(p))).toBe("INVALID_PATH");
  });
});

describe("assertLanguage", () => {
  it("accepts th", () => expect(assertLanguage("th")).toBe("th"));
  it("rejects fr", () => expect(code(() => assertLanguage("fr"))).toBe("INVALID_LANGUAGE"));
});

describe("validateLayoutSpec", () => {
  it("accepts max actions and breadcrumbs", () => {
    const spec: LayoutSpec = { title: "T", actions: n(5, action), breadcrumbs: n(6, crumb) };
    expect(validateLayoutSpec(spec)).toBe(spec);
  });
  it("rejects 6 actions", () => {
    expect(code(() => validateLayoutSpec({ actions: n(6, action) }))).toBe("INVALID_LAYOUT");
  });
  it("rejects 7 breadcrumbs", () => {
    expect(code(() => validateLayoutSpec({ breadcrumbs: n(7, crumb) }))).toBe("INVALID_LAYOUT");
  });
  it("rejects a 41-char label", () => {
    const label = "x".repeat(41);
    expect(code(() => validateLayoutSpec({ actions: [{ ...action(0), label }] }))).toBe("INVALID_LAYOUT");
    expect(code(() => validateLayoutSpec({ breadcrumbs: [{ label }] }))).toBe("INVALID_LAYOUT");
  });
  it("rejects a non-string title", () => {
    expect(code(() => validateLayoutSpec({ title: 1 as unknown as string }))).toBe("INVALID_LAYOUT");
  });
  it("rejects null spec and null entries with INVALID_LAYOUT", () => {
    expect(code(() => validateLayoutSpec(null as never))).toBe("INVALID_LAYOUT");
    expect(code(() => validateLayoutSpec({ actions: [null as never] }))).toBe("INVALID_LAYOUT");
    expect(code(() => validateLayoutSpec({ breadcrumbs: [null as never] }))).toBe("INVALID_LAYOUT");
  });
  it("accepts markup-looking text unchanged", () => {
    const spec = { title: "<img src=x onerror=alert(1)>" };
    expect(validateLayoutSpec(spec)).toEqual(spec);
  });
});

describe("ShellCommandError", () => {
  it("carries code and name", () => {
    const e = new ShellCommandError("SLOT_TAKEN", "x");
    expect(e.code).toBe("SLOT_TAKEN");
    expect(e.name).toBe("ShellCommandError");
  });
});
