import { createElement as h, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Alert, Badge, Breadcrumb, BreadcrumbItem, Button, Card, CardContent, CardHeader, CardTitle,
  Checkbox, DefinitionList, Input, NativeSelect, NavLink,
} from "../index";

const all: Record<string, ComponentType<any>> = {
  Button, Card, CardHeader, CardTitle, CardContent, Badge, Alert, Input, NativeSelect, Checkbox,
  Breadcrumb, BreadcrumbItem, NavLink, DefinitionList,
};

describe("components", () => {
  for (const [name, C] of Object.entries(all)) {
    it(`${name} forwards data-testid and className`, () => {
      const out = renderToString(h(C, { "data-testid": "x", className: "custom-cls" }));
      expect(out).toContain('data-testid="x"');
      expect(out).toContain("custom-cls");
    });
  }
  it("Button defaults type=button and an explicit type wins", () => {
    expect(renderToString(h(Button))).toContain('type="button"');
    expect(renderToString(h(Button, { type: "submit" }))).toContain('type="submit"');
  });
  it("Button and NavLink reset browser-default border and background (no preflight in remotes)", () => {
    for (const out of [
      renderToString(h(Button, { variant: "ghost" })),
      renderToString(h(NavLink, null, "x")),
    ]) {
      expect(out).toMatch(/[ "]border-0[ "]/);
      expect(out).toMatch(/[ "]bg-transparent[ "]/);
      expect(out).toContain("[font-family:inherit]");
    }
    expect(renderToString(h(Button, { variant: "outline" }))).toMatch(/[ "]border[ "].*border-border/);
  });
  it("every Button variant and NavLink state has an explicit base text token (buttons do not inherit colour)", () => {
    const base = /(^|[ "])text-(foreground|primary-foreground|secondary-foreground|destructive-foreground|muted-foreground)[ "]/;
    for (const v of ["default", "secondary", "outline", "ghost", "destructive"] as const)
      expect(renderToString(h(Button, { variant: v })), v).toMatch(base);
    expect(renderToString(h(NavLink, { active: true }, "x"))).toMatch(/[ "]text-accent-foreground[ "]/);
    expect(renderToString(h(NavLink, null, "x"))).toMatch(/[ "]text-muted-foreground[ "]/);
    expect(renderToString(h(NativeSelect))).toMatch(/[ "]pr-8[ "]/);
  });
  it("forwards ref to the rendered element (React 19 ref prop)", () => {
    const ref = () => {};
    for (const C of [Button, Input, NativeSelect, Checkbox, Card, Badge, Alert, NavLink, DefinitionList] as ComponentType<any>[]) {
      const el = (C as any)({ ref }) as any;
      expect(el.props.ref, C.name).toBe(ref);
    }
    // Breadcrumb wraps the <ol> in a <nav>; ref lands on the <ol>
    expect(((Breadcrumb as any)({ ref }) as any).props.children.props.ref).toBe(ref);
  });
  it("Breadcrumb aria-label lands on the nav (default breadcrumb), not the ol", () => {
    const def = renderToString(h(Breadcrumb, { id: "x" }));
    expect(def).toMatch(/^<nav aria-label="breadcrumb"><ol[^>]*id="x"/);
    const out = renderToString(h(Breadcrumb, { "aria-label": "Breadcrumbs" }));
    expect(out).toMatch(/^<nav aria-label="Breadcrumbs"><ol/);
    expect(out.match(/aria-label/g)).toHaveLength(1);
  });
  it("NativeSelect renders a select with children", () => {
    const out = renderToString(h(NativeSelect, null, h("option", { value: "a" }, "A")));
    expect(out.startsWith("<select")).toBe(true);
    expect(out).toContain("<option");
  });
  it("Checkbox renders a checkbox input", () => {
    expect(renderToString(h(Checkbox))).toContain('type="checkbox"');
  });
  it("Button variants use tokens", () => {
    const cls = (v?: "destructive") => renderToString(h(Button, { variant: v }));
    // exact class token: not hover:bg-x/90
    const has = (s: string, c: string) => new RegExp(`(^|[ "])${c}[ "]`).test(s);
    expect(has(cls("destructive"), "bg-destructive")).toBe(true);
    expect(has(cls("destructive"), "bg-primary")).toBe(false);
    expect(has(cls(), "bg-primary")).toBe(true);
    expect(has(cls(), "bg-destructive")).toBe(false);
    expect(renderToString(h(Button))).toContain("<button");
  });
  it("Alert non-default variants have role=alert", () => {
    expect(renderToString(h(Alert, { variant: "warning" }))).toContain('role="alert"');
    expect(renderToString(h(Alert, { variant: "destructive" }))).toContain('role="alert"');
    expect(renderToString(h(Alert))).not.toContain('role="alert"');
  });
  it("NavLink is a button with aria-current when active", () => {
    const on = renderToString(h(NavLink, { active: true }, "Home"));
    expect(on).toMatch(/^<button/);
    expect(on).toContain('aria-current="page"');
    expect(renderToString(h(NavLink, null, "Home"))).not.toContain("aria-current");
  });
});
