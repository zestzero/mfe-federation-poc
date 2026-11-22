import { expect, type Page } from "@playwright/test";

export class ShellPage {
  constructor(readonly page: Page) {}

  async goto(url = "/") {
    await this.page.goto(url);
  }

  status() {
    return this.page.getByTestId("session-status");
  }

  account() {
    return this.page.getByTestId("session-account");
  }

  revision() {
    return this.page.getByTestId("session-revision");
  }

  /** Cold start finished: the session left `transitioning` and both remotes registered. */
  async settled(status: "anonymous" | "authenticated" = "anonymous") {
    await expect(this.status()).toHaveText(status);
    await expect(this.remoteStatus("react")).toHaveText("mounted");
    await expect(this.remoteStatus("vue")).toHaveText("mounted");
  }

  async login() {
    await this.page.getByTestId("login").click();
    await this.status().filter({ hasText: "authenticated" }).waitFor();
  }

  async logout() {
    await this.page.getByTestId("logout").click();
    await this.status().filter({ hasText: "anonymous" }).waitFor();
  }

  async switchSouth() {
    await this.page.getByTestId("switch-south").click();
    await this.account().filter({ hasText: /South/ }).waitFor();
  }

  async switchNorth() {
    await this.page.getByTestId("switch-north").click();
    await this.account().filter({ hasText: /North/ }).waitFor();
  }

  async toggleReact() {
    await this.page.getByTestId("toggle-react").click();
  }

  async toggleVue() {
    await this.page.getByTestId("toggle-vue").click();
  }

  remoteStatus(id: "react" | "vue") {
    return this.page.getByTestId(`remote-status-${id}`);
  }

  remoteRoot(id: "react" | "vue") {
    return this.page.getByTestId(`remote-root-${id}`);
  }

  async setForceCleanupFail(enabled: boolean) {
    const box = this.page.getByTestId("force-cleanup-fail");
    if ((await box.isChecked()) !== enabled) await box.click();
  }

  eventLog() {
    return this.page.getByTestId("event-log");
  }

  title() {
    return this.page.getByTestId("shell-title");
  }

  breadcrumbs() {
    return this.page.getByTestId("shell-breadcrumbs");
  }

  action(id: string) {
    return this.page.getByTestId(`shell-action-${id}`);
  }

  async navTo(id: "orders" | "summary") {
    await this.page.getByTestId(`shell-nav-${id}`).click();
  }

  async setLanguage(language: "en" | "th") {
    await this.page.getByTestId("language-select").selectOption(language);
  }

  languageSelect() {
    return this.page.getByTestId("language-select");
  }

  slot(id: "header" | "sidebar") {
    return this.page.getByTestId(`slot-${id}`);
  }

  path() {
    return this.page.getByTestId("shell-path");
  }

  shellUser() {
    return this.page.getByTestId("shell-user");
  }
}
