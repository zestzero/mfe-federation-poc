import { expect, test } from "@playwright/test";
import { ShellPage } from "../page-objects/ShellPage";

test.describe("DI B/C smoke", () => {
  test.skip(!process.env.SHELL_B_URL, "Set SHELL_B_URL to run DI B smoke");
  test("B federated shell login shows remotes", async ({ browser }) => {
    const page = await browser.newPage();
    const shell = new ShellPage(page);
    await page.goto(process.env.SHELL_B_URL!);
    await shell.login();
    await expect(shell.remoteStatus("react")).toHaveText("mounted");
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(page.getByTestId("shell-nav-orders")).toBeVisible();
    await page.close();
  });
});

test.describe("DI C smoke", () => {
  test.skip(!process.env.SHELL_C_URL, "Set SHELL_C_URL to run DI C smoke");
  test("C shared-store shell shows anti-pattern banner", async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(process.env.SHELL_C_URL!);
    await expect(page.getByTestId("di-banner")).toContainText(/anti-pattern/i);
    const shell = new ShellPage(page);
    await shell.login();
    await expect(shell.slot("header")).toContainText("Open orders");
    await expect(page.getByTestId("shell-nav-orders")).toBeVisible();
    await page.close();
  });
});
