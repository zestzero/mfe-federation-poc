import { describe, expect, it } from "vitest";
import { h, type Component } from "vue";
import { renderToString } from "vue/server-renderer";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@poc/design-system/utils";
import {
  alertVariants,
  badgeVariants,
  breadcrumbClass,
  breadcrumbItemClass,
  buttonVariants,
  cardClass,
  cardContentClass,
  cardHeaderClass,
  cardTitleClass,
  checkboxClass,
  definitionListClass,
  inputClass,
  navLinkVariants,
  nativeSelectClass,
} from "@poc/design-system/variants";
import {
  Alert,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  DefinitionList,
  Input,
  NativeSelect,
  NavLink,
} from "./index";

const render = (c: Component, props: Record<string, unknown> = {}, slot = "x") =>
  renderToString(h(c, props, { default: () => slot }));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const hasToken = (html: string, token: string) =>
  new RegExp(`(^|[ "])${token.replace(/[/.]/g, "\\$&")}[ "]`).test(html);

describe("attribute inheritance", () => {
  const cases: [string, Component][] = [
    ["Button", Button],
    ["Card", Card],
    ["CardHeader", CardHeader],
    ["CardTitle", CardTitle],
    ["CardContent", CardContent],
    ["Badge", Badge],
    ["Alert", Alert],
    ["Input", Input],
    ["NativeSelect", NativeSelect],
    ["Checkbox", Checkbox],
    ["Breadcrumb", Breadcrumb],
    ["BreadcrumbItem", BreadcrumbItem],
    ["NavLink", NavLink],
    ["DefinitionList", DefinitionList],
  ];
  it.each(cases)("%s keeps data-testid and extra class", async (_n, c) => {
    const html = await render(c, { "data-testid": "t1", class: "extra-x" });
    expect(html).toContain('data-testid="t1"');
    expect(html).toContain("extra-x");
  });
  it("extra class overrides conflicting utilities like React cn()", async () => {
    const html = await render(Button, { class: "h-12" });
    expect(html).toContain("h-12");
    expect(html).not.toContain("h-9");
  });
});

describe("native elements", () => {
  it("NativeSelect is a real <select> that keeps options, value, disabled and data-testid", async () => {
    const html = await renderToString(
      h(
        NativeSelect,
        { value: "b", disabled: true, "data-testid": "s" },
        { default: () => [h("option", { value: "a" }, "A"), h("option", { value: "b" }, "B")] },
      ),
    );
    expect(html.startsWith("<select")).toBe(true);
    expect(html).toContain('data-testid="s"');
    expect(html).toContain("disabled");
    expect(html).toContain('<option value="a">A</option>');
    expect(html).toMatch(/<option value="b"[^>]*>B<\/option>/);
    expect(html).toMatch(/^<select[^>]*value="b"/);
  });
  it.each([
    ["Input", Input],
    ["NativeSelect", NativeSelect],
    ["Checkbox", Checkbox],
  ] as [string, Component][])("%s drops v-model attrs (unsupported) instead of leaking modelvalue", async (_n, c) => {
    const html = await render(c, { modelValue: "x", "onUpdate:modelValue": () => {} });
    expect(html.toLowerCase()).not.toContain("modelvalue");
  });
  it("Checkbox renders type=checkbox", async () => {
    expect(await render(Checkbox)).toContain('type="checkbox"');
  });
  it("Input renders <input", async () => {
    expect((await render(Input, { placeholder: "p" })).startsWith("<input")).toBe(true);
  });
  it("Breadcrumb root is nav and attrs land on the inner ol", async () => {
    const html = await render(Breadcrumb, { "data-testid": "bc" });
    expect(html).toMatch(/^<nav aria-label="breadcrumb"><ol[^>]*data-testid="bc"/);
  });
  it("Breadcrumb aria-label lands on the nav, not the ol", async () => {
    const html = await render(Breadcrumb, { "aria-label": "Breadcrumbs", "data-testid": "bc" });
    expect(html).toMatch(/^<nav aria-label="Breadcrumbs"><ol[^>]*data-testid="bc"/);
    expect(html.match(/aria-label/g)).toHaveLength(1);
  });
});

describe("tokens and a11y", () => {
  it("Button default/destructive use exact base tokens", async () => {
    const d = await render(Button);
    const x = await render(Button, { variant: "destructive" });
    expect(hasToken(d, "bg-primary")).toBe(true);
    expect(hasToken(d, "bg-destructive")).toBe(false);
    expect(hasToken(x, "bg-destructive")).toBe(true);
    expect(hasToken(x, "bg-primary")).toBe(false);
  });
  it.each([
    ["default", "text-primary-foreground"],
    ["secondary", "text-secondary-foreground"],
    ["outline", "text-foreground"],
    ["ghost", "text-foreground"],
    ["destructive", "text-destructive-foreground"],
  ])("Button %s has base %s", async (v, token) => {
    expect(hasToken(await render(Button, { variant: v }), token)).toBe(true);
  });
  it("Button defaults type=button and an explicit type wins", async () => {
    expect(await render(Button)).toContain('type="button"');
    expect(await render(Button, { type: "submit" })).toContain('type="submit"');
  });
  it("Button sm size applies", async () => {
    expect(await render(Button, { size: "sm" })).toContain("h-8");
  });
  it("NavLink active sets aria-current=page and base text token per state", async () => {
    const on = await render(NavLink, { active: true });
    const off = await render(NavLink);
    expect(on).toContain('aria-current="page"');
    expect(off).not.toContain("aria-current");
    expect(on).toContain('type="button"');
    expect(hasToken(on, "text-accent-foreground")).toBe(true);
    expect(hasToken(off, "text-muted-foreground")).toBe(true);
  });
  it("non-default Alert has role=alert, default does not", async () => {
    expect(await render(Alert)).not.toContain("role=");
    expect(await render(Alert, { variant: "warning" })).toContain('role="alert"');
    expect(await render(Alert, { variant: "destructive" })).toContain('role="alert"');
  });
});

describe("parity with shared class strings", () => {
  const cases: [string, Component, Record<string, unknown>, string][] = [
    ["Card", Card, {}, cardClass],
    ["CardHeader", CardHeader, {}, cardHeaderClass],
    ["CardTitle", CardTitle, {}, cardTitleClass],
    ["CardContent", CardContent, {}, cardContentClass],
    ["Input", Input, {}, inputClass],
    ["NativeSelect", NativeSelect, {}, nativeSelectClass],
    ["Checkbox", Checkbox, {}, checkboxClass],
    ["Breadcrumb", Breadcrumb, {}, breadcrumbClass],
    ["BreadcrumbItem", BreadcrumbItem, {}, breadcrumbItemClass],
    ["DefinitionList", DefinitionList, {}, definitionListClass],
    ["Button", Button, { variant: "outline", size: "sm" }, buttonVariants({ variant: "outline", size: "sm" })],
    ["Button default", Button, {}, buttonVariants()],
    ["Badge", Badge, { variant: "warning" }, badgeVariants({ variant: "warning" })],
    ["Alert", Alert, { variant: "destructive" }, alertVariants({ variant: "destructive" })],
    ["NavLink active", NavLink, { active: true }, navLinkVariants({ active: true })],
    ["NavLink idle", NavLink, {}, navLinkVariants({ active: false })],
  ];
  it.each(cases)("%s renders the shared class string", async (_n, c, props, shared) => {
    expect(await render(c, props)).toContain(`class="${esc(cn(shared))}"`); // React renders cn(shared) too (twMerge drops overridden bg-transparent)
  });

  const buttonVariantKeys = ["default", "secondary", "outline", "ghost", "destructive"] as const;
  const buttonSizeKeys = ["default", "sm"] as const;
  const badgeKeys = ["default", "secondary", "outline", "warning", "destructive"] as const;
  const alertKeys = ["default", "warning", "destructive"] as const;
  const every: [string, Component, Record<string, unknown>, string][] = [
    ...buttonVariantKeys.flatMap((variant) =>
      buttonSizeKeys.map((size): [string, Component, Record<string, unknown>, string] => [
        `Button ${variant}/${size}`, Button, { variant, size }, buttonVariants({ variant, size }),
      ]),
    ),
    ...badgeKeys.map((variant): [string, Component, Record<string, unknown>, string] => [
      `Badge ${variant}`, Badge, { variant }, badgeVariants({ variant }),
    ]),
    ...alertKeys.map((variant): [string, Component, Record<string, unknown>, string] => [
      `Alert ${variant}`, Alert, { variant }, alertVariants({ variant }),
    ]),
  ];
  it.each(every)("%s matches the shared variant class string", async (_n, c, props, shared) => {
    expect(await render(c, props)).toContain(`class="${esc(cn(shared))}"`);
  });
});

// Compile-time drift guard (checked by vue-tsc): Vue prop unions must equal the cva variant keys.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Prop<C extends abstract new (...a: never) => { $props: object }, K extends string> = NonNullable<
  (InstanceType<C>["$props"] & Record<K, unknown>)[K]
>;
const _typeDrift: [
  Equal<Prop<typeof Button, "variant">, NonNullable<VariantProps<typeof buttonVariants>["variant"]>>,
  Equal<Prop<typeof Button, "size">, NonNullable<VariantProps<typeof buttonVariants>["size"]>>,
  Equal<Prop<typeof Badge, "variant">, NonNullable<VariantProps<typeof badgeVariants>["variant"]>>,
  Equal<Prop<typeof Alert, "variant">, NonNullable<VariantProps<typeof alertVariants>["variant"]>>,
] = [true, true, true, true];
void _typeDrift;
