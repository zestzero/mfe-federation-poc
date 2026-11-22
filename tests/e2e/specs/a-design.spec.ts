import { expect, test, type Locator, type Page } from "@playwright/test";
import { MockApiControls } from "@poc/test-support";
import { ShellPage } from "../page-objects/ShellPage";

/** The colour `--foreground` resolves to on <html>, as the browser computes it. */
const foreground = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--foreground)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });

test.describe("shell-injected A: design system", () => {
  const controls = new MockApiControls();

  test.beforeEach(async ({ page }) => {
    await controls.reset();
    await new ShellPage(page).goto();
  });

  test("20 remote CSS reaches the page when mounted by the shell", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const expected = await foreground(page);
    // The colour alone is not proof: <main> inherits body's `color: var(--foreground)` and the shell
    // also compiles .text-foreground. Each remote also carries a class used in no other source
    // (shell, other remote, component packages), so only that remote's own CSS defines it; remote CSS
    // is global, so the classes must differ or one remote's CSS would satisfy both assertions.
    const discriminator = { react: "tabular-nums", vue: "slashed-zero" } as const;
    for (const id of ["react", "vue"] as const) {
      const root = shell.remoteRoot(id).locator("main.text-foreground");
      await expect(root).toBeVisible();
      await expect(root).toHaveCSS("color", expected);
      await expect(root, `${id} remote CSS not loaded`).toHaveCSS("font-variant-numeric", discriminator[id]);
    }
  });

  test("22 theme toggle switches the shell to dark", async ({ page }) => {
    const toggle = page.getByTestId("theme-toggle");
    const html = page.locator("html");
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const light = await bodyBg();

    await toggle.click();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await bodyBg()).not.toBe(light);

    await toggle.click();
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await bodyBg()).toBe(light);
  });

  test("23 shell chrome keeps native controls", async ({ page }) => {
    const shell = new ShellPage(page);
    expect(await shell.languageSelect().evaluate((el) => el.tagName)).toBe("SELECT");
    await shell.setLanguage("th");
    await expect(shell.languageSelect()).toHaveValue("th");
  });
  // Scenarios 20, 22 and 23 exist; 24 is the next free number.
  test("24 force-cleanup-fail is still a checkbox and panels follow the theme", async ({ page }) => {
    const box = page.getByTestId("force-cleanup-fail");
    await expect(box).toHaveJSProperty("tagName", "INPUT");
    await expect(box).toHaveAttribute("type", "checkbox");
    expect(await box.isChecked()).toBe(false);
    await box.click();
    expect(await box.isChecked()).toBe(true);
    await box.click();
    expect(await box.isChecked()).toBe(false);

    // Card look = same border and background as the (already themed) remote host card.
    const look = (id: string) =>
      page.getByTestId(id).evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopColor, bg: s.backgroundColor };
      });
    const panel = () => look("session-panel");
    const reference = () => look("remote-host-react");

    const light = await panel();
    expect(light).toEqual(await reference());
    expect(light.bg).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const dark = await panel();
    expect(dark).toEqual(await reference());
    expect(dark.border).not.toBe(light.border);
    expect(dark.bg).not.toBe(light.bg);
  });
  // Scenarios 20 to 24 exist; 25 is the next free number.
  test("25 react remote uses design-system tokens", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const open = page.getByTestId("react-order-open-order_north_1");
    const badge = page.getByTestId("react-open-orders");
    await expect(open).toBeVisible();
    await expect(badge).toBeVisible();

    // Same variant and size as theme-toggle (outline + sm), so the radius and font size must match.
    const metrics = (id: string) =>
      page.getByTestId(id).evaluate((el) => {
        const s = getComputedStyle(el);
        return { radius: s.borderTopLeftRadius, fontSize: s.fontSize };
      });
    const reference = await metrics("theme-toggle");
    expect(reference.radius).not.toBe("0px");
    expect(await metrics("react-order-open-order_north_1")).toEqual(reference);

    const paint = () =>
      badge.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
    const light = await paint();
    expect(light.bg).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const dark = await paint();
    expect(dark.bg !== light.bg || dark.color !== light.color).toBe(true);

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await paint()).toEqual(light);
  });

  // Scenarios 20 to 25 exist; 26 is the next free number.
  test("26 vue remote follows the shell theme and tokens", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const sidebar = page.getByTestId("vue-sidebar-card");
    const summary = page.getByTestId("vue-summary");
    await expect(sidebar).toBeVisible();
    await expect(summary).toBeVisible();

    const bg = (loc: typeof sidebar) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
    const light = { sidebar: await bg(sidebar), summary: await bg(summary) };
    expect(light.sidebar).not.toBe("rgba(0, 0, 0, 0)");
    expect(light.summary).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await bg(sidebar)).not.toBe(light.sidebar);
    expect(await bg(summary)).not.toBe(light.summary);

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await bg(sidebar)).toBe(light.sidebar);
    expect(await bg(summary)).toBe(light.summary);

    // Same NativeSelect look as the shell's language select, and it still works.
    const picker = page.getByTestId("vue-language-picker");
    expect(await picker.evaluate((el) => el.tagName)).toBe("SELECT");
    const radius = (loc: typeof picker) => loc.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const reference = await radius(shell.languageSelect());
    expect(reference).not.toBe("0px");
    expect(await radius(picker)).toBe(reference);
    const heading = page.getByTestId("vue-heading");
    const before = await heading.textContent();
    await picker.selectOption("th");
    await expect(heading).not.toHaveText(before ?? "");

    // Opposite direction: the picker is controlled by the shell, so a shell change moves it.
    await shell.setLanguage("en");
    await expect(picker).toHaveValue("en");
    await shell.setLanguage("th");
    await expect(picker).toHaveValue("th");
  });

  // Scenarios 20 to 26 exist; 27 to 29 below.
  const paintOf = (page: Page) => {
    const read = (loc: Locator) =>
      loc.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
    return {
      react: () => read(page.getByTestId("remote-root-react").locator("main")),
      vue: () => read(page.getByTestId("remote-root-vue").locator("main")),
      header: () => read(page.getByTestId("react-open-orders")),
      sidebar: () => read(page.getByTestId("vue-sidebar-card")),
    };
  };

  test("27 theme survives an account switch", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const html = page.locator("html");
    const paint = paintOf(page);
    const snap = async () => ({
      react: await paint.react(),
      vue: await paint.vue(),
      header: await paint.header(),
      sidebar: await paint.sidebar(),
    });
    await expect(page.getByTestId("vue-sidebar-card")).toBeVisible();
    await expect(page.getByTestId("react-open-orders")).toBeVisible();

    const light = await snap();
    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveClass(/\bdark\b/);
    const dark = await snap();
    // Non-vacuous: each surface really changes between light and dark (card/badge backgrounds), and
    // every surface has a non-transparent background or a changed text colour.
    expect(dark.header).not.toEqual(light.header);
    expect(dark.sidebar).not.toEqual(light.sidebar);
    expect(dark.react.color).not.toBe(light.react.color);
    expect(dark.vue.color).not.toBe(light.vue.color);
    expect(dark.sidebar.bg).not.toBe("rgba(0, 0, 0, 0)");

    await shell.switchSouth();
    await expect(shell.status()).toHaveText("authenticated");
    await expect(shell.account()).toContainText("South");
    await expect(shell.slot("sidebar").getByTestId("vue-sidebar-account")).toContainText("South");
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(html).toHaveClass(/\bdark\b/);
    // Slots were cleared and re-rendered after resume: they must be painted with the dark tokens.
    expect(await snap()).toEqual(dark);
  });

  test("28 theme survives forced cleanup failure and remount", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const html = page.locator("html");
    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveClass(/\bdark\b/);

    await shell.setForceCleanupFail(true);
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("idle");
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await page.getByTestId("switch-south").click();
    await expect(shell.status()).toHaveText("error");
    await expect(html).toHaveClass(/\bdark\b/);

    for (const id of ["react", "vue"] as const) {
      const alert = shell.remoteRoot(id).getByRole("alert");
      await expect(alert).toContainText(/paused/i);
      const { bg, color } = await alert.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
      expect(bg, `${id} alert background is transparent`).not.toBe("rgba(0, 0, 0, 0)");
      expect(color, `${id} alert text equals its background`).not.toBe(bg);
    }

    await shell.setForceCleanupFail(false);
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("idle");
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.remoteStatus("vue")).toHaveText("mounted");
    await shell.login();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(shell.slot("header")).toContainText("Open orders");
    const paint = paintOf(page);
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dark again after remount: the remote surfaces differ from the light-mode values.
    await page.getByTestId("theme-toggle").click();
    await expect(html).not.toHaveClass(/\bdark\b/);
    const lightHeader = await paint.header();
    const lightSidebar = await paint.sidebar();
    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveClass(/\bdark\b/);
    expect(await paint.header()).not.toEqual(lightHeader);
    expect(await paint.sidebar()).not.toEqual(lightSidebar);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(body);
  });

  test("29 tokens agree across shell and remotes", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await expect(page.getByTestId("react-order-open-order_north_1")).toBeVisible();
    await expect(page.getByTestId("vue-language-picker")).toBeVisible();
    const style = (id: string, prop: "borderTopLeftRadius" | "fontFamily") =>
      page.getByTestId(id).evaluate((el, p) => getComputedStyle(el)[p as "fontFamily"], prop);

    const toggleRadius = await style("theme-toggle", "borderTopLeftRadius");
    expect(toggleRadius).not.toBe("0px");
    expect(await style("react-order-open-order_north_1", "borderTopLeftRadius")).toBe(toggleRadius);
    const selectRadius = await style("language-select", "borderTopLeftRadius");
    expect(selectRadius).not.toBe("0px");
    expect(await style("vue-language-picker", "borderTopLeftRadius")).toBe(selectRadius);

    // Font: remotes ship no preflight, so headings are not styled by tokens.css directly; they inherit
    // the host's font. The host family must still be a real stack and every remote control must inherit.
    const family = await style("shell-title", "fontFamily");
    expect(family.length).toBeGreaterThan(0);
    expect(await style("react-heading", "fontFamily")).toBe(family);
    expect(await style("vue-heading", "fontFamily")).toBe(family);
    for (const id of ["react-order-open-order_north_1", "vue-language-picker", "theme-toggle", "language-select"]) {
      const own = await page.getByTestId(id).evaluate((el) => ({
        own: getComputedStyle(el).fontFamily,
        parent: getComputedStyle(el.parentElement!).fontFamily,
      }));
      expect(own.own, `${id} does not inherit its parent's font`).toBe(own.parent);
    }
  });
});
