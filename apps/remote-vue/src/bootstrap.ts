// Standalone dev only (the shell never loads bootstrap): tokens + preflight the shell would provide.
import "@poc/design-system/standalone.css";
import type { SessionApi } from "@poc/platform-contracts";
import { mount } from "./mount.js";

const listeners = new Set<() => void>();
const state = { status: "authenticated" as const, subjectId: "fictional-user-1", accountId: "fictional-account-1", contextRevision: 1 };
const session: SessionApi = {
  contractVersion: 1,
  getSnapshot: () => state,
  subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  async requestLogin() {},
  async requestLogout() {},
  async requestAccountChange(accountId) { state.accountId = accountId; state.contextRevision++; listeners.forEach((listener) => listener()); },
};
const target = document.getElementById("root");
if (!target) throw new Error("Missing app root");
mount(target, { session });
