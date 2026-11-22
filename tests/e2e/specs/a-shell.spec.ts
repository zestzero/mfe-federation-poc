import { expect, test } from "@playwright/test";
import { MockApiControls } from "@poc/test-support";
import { ShellPage } from "../page-objects/ShellPage";

const REACT_HEADING_TH = "คำสั่งซื้อ React (สมมติ)";
const VUE_HEADING_TH = "สรุปบัญชี Vue (สมมติ)";
const NORTH_ORDER = "order_north_1";

test.describe("shell-injected A: shell state, layout and slots", () => {
  const controls = new MockApiControls();

  test.beforeEach(async ({ page }) => {
    await controls.reset();
    const shell = new ShellPage(page);
    await shell.goto();
  });

  test("10 language set in the shell reaches both remotes", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const revision = await shell.revision().textContent();
    await shell.setLanguage("th");
    await expect(page.getByTestId("react-heading")).toHaveText(REACT_HEADING_TH);
    await expect(page.getByTestId("vue-heading")).toHaveText(VUE_HEADING_TH);
    await expect(shell.revision()).toHaveText(revision!);
  });

  test("11 language set by a remote reaches the shell and the other remote", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    const revision = await shell.revision().textContent();
    await shell.slot("sidebar").getByTestId("vue-language-picker").selectOption("th");
    await expect(shell.languageSelect()).toHaveValue("th");
    await expect(page.getByTestId("react-heading")).toHaveText(REACT_HEADING_TH);
    await expect(shell.revision()).toHaveText(revision!);
  });

  test("12 remote navigate and layout", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await page.getByTestId(`react-order-open-${NORTH_ORDER}`).click();
    await expect(shell.path()).toHaveText(`/orders/${NORTH_ORDER}`);
    await expect(shell.title()).toContainText("Order");
    await expect(shell.breadcrumbs()).toContainText("Orders");
    const refetch = page.waitForRequest(
      (request) => request.url().endsWith("/api/orders") && request.method() === "GET",
    );
    await shell.action("refresh").click();
    await refetch;
  });

  test("13 shell nav drives remote view and active layout", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await expect(shell.title()).toHaveText("Orders");
    await shell.navTo("summary");
    await expect(shell.path()).toHaveText("/summary");
    await expect(shell.title()).toHaveText("Account summary");
    await shell.navTo("orders");
    await expect(shell.path()).toHaveText("/orders");
    await expect(shell.title()).toHaveText("Orders");
  });

  test("14 slots render remote content", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(shell.slot("sidebar").getByTestId("vue-sidebar-account")).toContainText("North");
  });

  test("15 no old-account text in slots during a switch", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await expect(shell.slot("sidebar").getByTestId("vue-sidebar-account")).toContainText("North");
    await expect(shell.slot("sidebar").getByTestId("vue-language-picker")).toBeVisible();
    await page.getByTestId(`react-order-open-${NORTH_ORDER}`).click();
    await expect(shell.path()).toHaveText(`/orders/${NORTH_ORDER}`);

    // Hold the transition open (below the coordinator's 3000ms transition timeout): the shell only
    // leaves `transitioning` once mock-api confirms the account.
    await controls.delay(2000, ["/api/session/account"]);
    await page.getByTestId("switch-south").click();
    await expect(shell.status()).toHaveText("transitioning");
    // The picker renders whatever the session status, so its absence proves the shell emptied the slot
    // (the card itself hides the account text unless authenticated).
    await expect(shell.slot("sidebar").getByTestId("vue-language-picker")).toHaveCount(0);
    await expect(shell.slot("sidebar")).toBeAttached();
    await expect(shell.slot("sidebar")).not.toContainText("North");
    // Decoration only: the badge renders null whenever the session is not authenticated, so this
    // cannot tell shell clearing from the remote's own rendering.
    await expect(shell.slot("header")).toBeEmpty();
    await expect(shell.path()).toHaveText("/orders");
    // Still inside the held transition, so the checks above ran while transitioning.
    await expect(shell.status()).toHaveText("transitioning");

    await expect(shell.account()).toContainText("South");
    await expect(shell.slot("sidebar").getByTestId("vue-sidebar-account")).toContainText("South");
    await expect(shell.slot("sidebar")).not.toContainText("North");
    await expect(shell.path()).toHaveText("/orders");
  });

  test("16 forced cleanup failure removes slot content", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    // An explicit remount (as in scenario 7) guarantees React is mounted with forceCleanupFail.
    await shell.setForceCleanupFail(true);
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("idle");
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.slot("header")).toContainText("Open orders");

    await expect(shell.slot("sidebar").getByTestId("vue-language-picker")).toBeVisible();

    await page.getByTestId("switch-south").click();
    await expect(shell.remoteRoot("react")).toContainText(/paused/i);
    await expect(shell.remoteRoot("vue")).toContainText(/paused/i);
    // Fail closed: the session ends in `error` and both blocked remotes lose their slot content.
    await expect(shell.status()).toHaveText("error");
    // Header check is decoration only: the badge renders null for any non-authenticated status, `error`
    // included. The sidebar check is the real one (the picker would render in `error`).
    await expect(shell.slot("header")).toBeEmpty();
    await expect(shell.slot("sidebar")).toBeEmpty();

    // Clearing the flag remounts both remotes; toggle React as well for an explicit remount.
    await shell.setForceCleanupFail(false);
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("idle");
    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.remoteStatus("vue")).toHaveText("mounted");
    await expect(shell.slot("sidebar").getByTestId("vue-language-picker")).toBeVisible();
    // The header badge renders only for an authenticated session.
    await shell.login();
    await expect(shell.slot("header")).toContainText("Open orders");
  });

  test("17 unmount removes layout and slots", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.login();
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(shell.action("refresh")).toBeVisible();

    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("idle");
    await expect(shell.slot("header")).toBeEmpty();
    await expect(shell.action("refresh")).toHaveCount(0);

    await shell.toggleReact();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(shell.action("refresh")).toBeVisible();
  });

  test("18 a long order id (deep link and in-session) still yields a valid layout", async ({ page }) => {
    const shell = new ShellPage(page);
    const longPath = `/orders/order_${"z".repeat(54)}`; // 60-character id
    // reload so the remote mounts with the long path already set (deep link)
    await page.goto(`/#${longPath}`);
    await page.reload();
    await expect(shell.path()).toHaveText(longPath);
    // "mounted" is only shown after registry.register succeeded
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.title()).toContainText("Order order_zzz");
    expect((await shell.title().textContent())!.length).toBeLessThanOrEqual(40);

    // login truncates the path to the route root; set the long id again in-session
    await shell.login();
    await page.evaluate((path) => {
      location.hash = `#${path}`;
    }, longPath);
    await expect(shell.path()).toHaveText(longPath);
    await expect(page.getByTestId("react-heading")).toBeVisible();
    await expect(shell.remoteRoot("react")).toContainText("Order not found");
    await expect(shell.title()).toContainText("…");
    // Vue still receives shell notifications (language) after React's listener ran
    await shell.setLanguage("th");
    await expect(page.getByTestId("vue-heading")).toHaveText(VUE_HEADING_TH);
  });

  test("19 browser Back does not restore a previous account's order id", async ({ page }) => {
    const shell = new ShellPage(page);
    // Seed one in-app entry (an external hash edit pushes) so Back provably lands inside the app.
    await page.evaluate(() => {
      location.hash = "#/summary";
    });
    await expect(shell.path()).toHaveText("/summary");
    await shell.navTo("orders");
    await shell.login();
    await page.getByTestId(`react-order-open-${NORTH_ORDER}`).click();
    await expect(shell.path()).toHaveText(`/orders/${NORTH_ORDER}`);
    await shell.switchSouth();
    await expect(shell.path()).toHaveText("/orders");

    // The shell pushes no entries, so Back goes to the seeded entry's predecessor (`/#/orders`), not the North order.
    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(NORTH_ORDER));
    await expect(shell.path()).toHaveText("/orders");
    await expect(shell.account()).toContainText("South");
    await expect(shell.title()).toHaveText("Orders");
    await expect(shell.title()).not.toContainText(NORTH_ORDER);
  });
});
