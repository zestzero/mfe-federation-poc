import { describe, expect, it, vi } from "vitest";
import { SESSION_CONTRACT_VERSION, type SessionApi, type SessionSnapshot } from "@poc/platform-contracts";
import { createShellCore, createShellRuntime } from "./createShellRuntime";

function fakeSession(initial: SessionSnapshot = { status: "anonymous", contextRevision: 0 }) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const getSnapshot = vi.fn(() => snapshot);
  const api: SessionApi = {
    contractVersion: SESSION_CONTRACT_VERSION,
    getSnapshot,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    requestLogin: vi.fn(),
    requestLogout: vi.fn(),
    requestAccountChange: vi.fn(),
  };
  return {
    api,
    listeners,
    set(next: SessionSnapshot) {
      snapshot = next;
      for (const l of [...listeners]) l();
    },
  };
}

const routes = { "/orders": "react", "/summary": "vue" };
const resolveUser = (subjectId: string) => ({ subjectId, displayName: `Name ${subjectId}` });
const make = (session = fakeSession()) => ({
  session,
  core: createShellCore({ session: session.api, routes, resolveUser }),
});
const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
};

describe("shell core", () => {
  it("starts at /orders, en, anonymous user", () => {
    expect(make().core.getState()).toEqual({ path: "/orders", language: "en", user: null });
  });

  it("navigate validates against route prefixes", () => {
    const { core } = make();
    core.navigate("/summary");
    expect(core.getState().path).toBe("/summary");
    core.navigate("/orders/ord_1");
    expect(core.getState().path).toBe("/orders/ord_1");
    expect(code(() => core.navigate("/nope"))).toBe("INVALID_PATH");
    expect(code(() => core.navigate("bad path"))).toBe("INVALID_PATH");
    expect(core.getState().path).toBe("/orders/ord_1");
  });

  it("setLanguage validates", () => {
    const { core } = make();
    core.setLanguage("th");
    expect(core.getState().language).toBe("th");
    expect(code(() => core.setLanguage("fr" as never))).toBe("INVALID_LANGUAGE");
  });

  it("keeps state identity until a field changes; no-op changes do not notify", () => {
    const { core } = make();
    const first = core.getState();
    expect(core.getState()).toBe(first);
    const onChange = vi.fn();
    core.subscribe(onChange);
    core.navigate("/orders");
    core.setLanguage("en");
    expect(core.getState()).toBe(first);
    expect(onChange).not.toHaveBeenCalled();
    core.navigate("/summary");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(core.getState()).not.toBe(first);
    expect(Object.isFrozen(core.getState())).toBe(true);
  });

  it("user follows the session", () => {
    const { core, session } = make();
    const onChange = vi.fn();
    core.subscribe(onChange);
    session.set({ status: "authenticated", subjectId: "user_ava", accountId: "a1", contextRevision: 1 });
    expect(core.getState().user).toEqual(resolveUser("user_ava"));
    expect(onChange).toHaveBeenCalledTimes(1);
    session.set({ status: "transitioning", contextRevision: 2 });
    expect(core.getState().user).toBeNull();
    session.set({ status: "authenticated", subjectId: "user_ava", accountId: "a2", contextRevision: 3 });
    session.set({ status: "anonymous", contextRevision: 4 });
    expect(core.getState().user).toBeNull();
  });

  it("session change that keeps the same user does not change state identity", () => {
    const { core, session } = make();
    session.set({ status: "authenticated", subjectId: "user_ava", accountId: "a1", contextRevision: 1 });
    const s = core.getState();
    session.set({ status: "authenticated", subjectId: "user_ava", accountId: "a2", contextRevision: 2 });
    expect(core.getState()).toBe(s);
  });

  it("getView resolves the active remote from the path", () => {
    const { core } = make();
    core.navigate("/orders/ord_1");
    expect(core.getView()).toEqual({ activeRemoteId: "react", layout: null });
    core.navigate("/summary");
    expect(core.getView().activeRemoteId).toBe("vue");
  });

  it("navigate and setLanguage never touch the session", () => {
    const { core, session } = make();
    const before = session.api.getSnapshot();
    const calls = (session.api.getSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    core.navigate("/summary");
    core.setLanguage("th");
    expect((session.api.getSnapshot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
    expect(session.api.getSnapshot()).toBe(before);
    expect(before.contextRevision).toBe(0);
    expect(session.api.requestLogin).not.toHaveBeenCalled();
    expect(session.api.requestLogout).not.toHaveBeenCalled();
    expect(session.api.requestAccountChange).not.toHaveBeenCalled();
  });

  it("subscribe unsubscribes; dispose removes the session listener", () => {
    const { core, session } = make();
    const onChange = vi.fn();
    const off = core.subscribe(onChange);
    core.navigate("/summary");
    off();
    core.navigate("/orders");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(session.listeners.size).toBe(1);
    core.dispose();
    expect(session.listeners.size).toBe(0);
  });
});

describe("createShellRuntime shell commands", () => {
  it("shellNavigate and shellSetLanguage validate and work with no remote registered", () => {
    const session = fakeSession({ status: "authenticated", contextRevision: 3, subjectId: "user_ava" } as SessionSnapshot);
    const runtime = createShellRuntime({ session: session.api, routes, resolveUser });
    const onChange = vi.fn();
    runtime.subscribe(onChange);
    expect(runtime.getView()).toEqual({ activeRemoteId: "react", layout: null });

    runtime.shellNavigate("/summary/x");
    expect(runtime.getState().path).toBe("/summary/x");
    expect(runtime.getView().activeRemoteId).toBe("vue");
    expect(code(() => runtime.shellNavigate("/nope"))).toBe("INVALID_PATH");
    expect(code(() => runtime.shellNavigate("Bad"))).toBe("INVALID_PATH");
    expect(runtime.getState().path).toBe("/summary/x");

    runtime.shellSetLanguage("th");
    expect(runtime.getState().language).toBe("th");
    expect(code(() => runtime.shellSetLanguage("fr" as never))).toBe("INVALID_LANGUAGE");
    expect(runtime.getState().language).toBe("th");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(session.api.getSnapshot().contextRevision).toBe(3);
    expect(session.api.requestAccountChange).not.toHaveBeenCalled();
    runtime.dispose();
    expect(session.listeners.size).toBe(0);
  });

  it("shellNavigate keeps only the route root while transitioning", () => {
    const session = fakeSession();
    const runtime = createShellRuntime({ session: session.api, routes, resolveUser });
    session.set({ status: "transitioning", contextRevision: 1 });
    runtime.shellNavigate("/orders/ord_1");
    expect(runtime.getState().path).toBe("/orders");
    runtime.dispose();
  });
});

type FakeEl = HTMLElement & { nodes: unknown[] };
const fakeEl = () => {
  const el = { nodes: [] as unknown[], replaceChildren: (...nodes: unknown[]) => (el.nodes = nodes) };
  return el as unknown as FakeEl;
};
/** render that writes a marker and returns a cleanup spy */
const renderer = () => {
  const cleanup = vi.fn();
  const render = vi.fn((el: HTMLElement) => {
    (el as FakeEl).nodes = ["content"];
    return cleanup;
  });
  return { render, cleanup };
};

describe("facade layout", () => {
  it("view shows only the active remote's layout; releases are independent", () => {
    const { core } = make();
    const react = core.forRemote("react");
    const vue = core.forRemote("vue");
    const releaseA = react.setLayout({ title: "A" });
    vue.setLayout({ title: "B" });
    expect(core.getView().layout?.title).toBe("A");
    core.navigate("/summary");
    expect(core.getView().layout?.title).toBe("B");
    releaseA();
    expect(core.getView().layout?.title).toBe("B");
    core.navigate("/orders");
    expect(core.getView().layout).toBeNull();
  });

  it("setLayout notifies and keeps view identity stable between changes", () => {
    const { core } = make();
    const onChange = vi.fn();
    core.subscribe(onChange);
    const release = core.forRemote("react").setLayout({ title: "A" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(core.getView()).toBe(core.getView());
    release();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(core.getView().layout).toBeNull();
  });

  it("invalid spec throws INVALID_LAYOUT and keeps the previous spec", () => {
    const { core } = make();
    const react = core.forRemote("react");
    react.setLayout({ title: "A" });
    expect(code(() => react.setLayout({ title: 1 as never }))).toBe("INVALID_LAYOUT");
    expect(code(() => react.setLayout(null as never))).toBe("INVALID_LAYOUT");
    expect(core.getView().layout?.title).toBe("A");
  });

  it("stores a deep frozen copy and never invokes onSelect", () => {
    const { core } = make();
    const onSelect = vi.fn();
    const spec = {
      title: "A",
      breadcrumbs: [{ label: "Home", path: "/orders" }],
      actions: [{ id: "x", label: "X", onSelect }],
    };
    core.forRemote("react").setLayout(spec);
    spec.title = "changed";
    spec.actions.push({ id: "y", label: "Y", onSelect });
    spec.actions[0]!.label = "changed";
    spec.breadcrumbs[0]!.label = "changed";
    const layout = core.getView().layout!;
    expect(layout).toEqual({
      title: "A",
      breadcrumbs: [{ label: "Home", path: "/orders" }],
      actions: [{ id: "x", label: "X", onSelect }],
    });
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.actions)).toBe(true);
    expect(Object.isFrozen(layout.actions![0])).toBe(true);
    expect(Object.isFrozen(layout.breadcrumbs)).toBe(true);
    expect(Object.isFrozen(layout.breadcrumbs![0])).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("facade slots", () => {
  it("defers render until the element is attached", () => {
    const { core } = make();
    const { render } = renderer();
    core.forRemote("react").claimSlot("header", render);
    expect(render).not.toHaveBeenCalled();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(el);
  });

  it("renders immediately when the element is already attached", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("sidebar", el);
    const { render } = renderer();
    core.forRemote("react").claimSlot("sidebar", render);
    expect(render).toHaveBeenCalledWith(el);
    expect(el.nodes).toEqual(["content"]);
  });

  it("slots are exclusive until released", () => {
    const { core } = make();
    const release = core.forRemote("react").claimSlot("header", renderer().render);
    const vue = core.forRemote("vue");
    expect(code(() => vue.claimSlot("header", renderer().render))).toBe("SLOT_TAKEN");
    release();
    expect(code(() => vue.claimSlot("header", renderer().render))).toBeUndefined();
  });

  it("release runs cleanup once and empties the element", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const { render, cleanup } = renderer();
    const release = core.forRemote("react").claimSlot("header", render);
    release();
    release();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(el.nodes).toEqual([]);
  });

  it("a throwing render is contained, empties the element and drops the claim", () => {
    const { core } = make();
    const react = core.forRemote("react");
    const boom = () => {
      (el as FakeEl).nodes = ["partial"];
      throw new Error("boom");
    };
    const el = fakeEl();
    const release = react.claimSlot("header", boom);
    expect(() => core.attachSlotElement("header", el)).not.toThrow();
    expect(el.nodes).toEqual([]);
    expect(() => release()).not.toThrow();
    const again = core.forRemote("vue").claimSlot("header", renderer().render);
    expect(el.nodes).toEqual(["content"]);
    again();
    // same, when the element is already attached at claim time
    expect(() => react.claimSlot("header", boom)).not.toThrow();
    expect(el.nodes).toEqual([]);
    expect(code(() => core.forRemote("vue").claimSlot("header", renderer().render))).toBeUndefined();
  });

  it("a throwing cleanup is contained and the element is emptied", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const release = core.forRemote("react").claimSlot("header", (e) => {
      (e as FakeEl).nodes = ["content"];
      return () => {
        throw new Error("boom");
      };
    });
    expect(() => release()).not.toThrow();
    expect(el.nodes).toEqual([]);
  });

  it("re-attaching the same element does not render twice", () => {
    const { core } = make();
    const el = fakeEl();
    const { render } = renderer();
    core.forRemote("react").claimSlot("header", render);
    core.attachSlotElement("header", el);
    core.attachSlotElement("header", el);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("detach runs cleanup and keeps the claim; re-attach renders again; release after detach does not clean twice", () => {
    const { core } = make();
    const el = fakeEl();
    const { render, cleanup } = renderer();
    const release = core.forRemote("react").claimSlot("header", render);
    core.attachSlotElement("header", el);
    core.attachSlotElement("header", null);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(el.nodes).toEqual([]);
    expect(code(() => core.forRemote("vue").claimSlot("header", renderer().render))).toBe("SLOT_TAKEN");
    const el2 = fakeEl();
    core.attachSlotElement("header", el2);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenLastCalledWith(el2);
    core.attachSlotElement("header", null);
    release();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("swapping elements cleans the old one before rendering into the new one", () => {
    const { core } = make();
    const el1 = fakeEl();
    const el2 = fakeEl();
    const { render, cleanup } = renderer();
    core.attachSlotElement("header", el1);
    core.forRemote("react").claimSlot("header", render);
    core.attachSlotElement("header", el2);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(el1.nodes).toEqual([]);
    expect(el2.nodes).toEqual(["content"]);
  });

  it("a render that returns no function is tolerated", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const release = core.forRemote("react").claimSlot("header", (() => undefined) as never);
    expect(() => release()).not.toThrow();
  });
});

describe("revocation", () => {
  it("revoke releases layout and slots and blocks commands", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const react = core.forRemote("react");
    const releaseLayout = react.setLayout({ title: "A" });
    const { render, cleanup } = renderer();
    const releaseSlot = react.claimSlot("header", render);
    const onChange = vi.fn();
    core.subscribe(onChange);
    core.revoke("react");
    expect(onChange).toHaveBeenCalled();
    expect(core.getView().layout).toBeNull();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(el.nodes).toEqual([]);
    expect(code(() => react.setLayout({ title: "B" }))).toBe("FACADE_REVOKED");
    expect(code(() => react.claimSlot("sidebar", render))).toBe("FACADE_REVOKED");
    expect(code(() => react.navigate("/summary"))).toBe("FACADE_REVOKED");
    expect(code(() => react.setLanguage("th"))).toBe("FACADE_REVOKED");
    expect(() => releaseLayout()).not.toThrow();
    expect(() => releaseSlot()).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(react.getState()).toBe(core.getState());
    const listener = vi.fn();
    const off = react.subscribe(listener);
    core.navigate("/summary");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    expect(() => core.revoke("unknown")).not.toThrow();
  });

  it("forRemote again revokes the old facade; old releases do not touch the new facade", () => {
    const { core } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const first = core.forRemote("react");
    const oldLayout = first.setLayout({ title: "old" });
    const oldSlot = first.claimSlot("header", renderer().render);
    const second = core.forRemote("react");
    expect(second).not.toBe(first);
    expect(code(() => first.setLayout({ title: "x" }))).toBe("FACADE_REVOKED");
    second.setLayout({ title: "new" });
    const { render, cleanup } = renderer();
    second.claimSlot("header", render);
    oldLayout();
    oldSlot();
    expect(core.getView().layout?.title).toBe("new");
    expect(cleanup).not.toHaveBeenCalled();
    expect(el.nodes).toEqual(["content"]);
    expect(code(() => core.forRemote("vue").claimSlot("header", renderer().render))).toBe("SLOT_TAKEN");
  });

  it("facade navigate and setLanguage work while live and never change contextRevision", () => {
    const { core, session } = make();
    const react = core.forRemote("react");
    expect(react.contractVersion).toBe(1);
    react.navigate("/summary");
    react.setLanguage("th");
    expect(core.getState()).toMatchObject({ path: "/summary", language: "th" });
    expect(session.api.getSnapshot().contextRevision).toBe(0);
  });
});

describe("createShellRuntime facade", () => {
  it("forRemote and attachSlotElement are wired", () => {
    const runtime = createShellRuntime({ session: fakeSession().api, routes, resolveUser });
    const el = fakeEl();
    runtime.attachSlotElement("header", el);
    const react = runtime.forRemote("react");
    react.claimSlot("header", renderer().render);
    react.setLayout({ title: "A" });
    expect(el.nodes).toEqual(["content"]);
    expect(runtime.getView().layout?.title).toBe("A");
  });
});

describe("review fixes", () => {
  it("a throwing render reached through attachSlotElement notifies", () => {
    const { core } = make();
    core.forRemote("react").claimSlot("header", () => {
      throw new Error("boom");
    });
    const onChange = vi.fn();
    core.subscribe(onChange);
    core.attachSlotElement("header", fakeEl());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("a throwing render at claim time notifies once", () => {
    const { core } = make();
    core.attachSlotElement("header", fakeEl());
    const onChange = vi.fn();
    core.subscribe(onChange);
    core.forRemote("react").claimSlot("header", () => {
      throw new Error("boom");
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("claimSlot rejects an unknown slot id at runtime", () => {
    const { core } = make();
    expect(code(() => core.forRemote("react").claimSlot("footer" as never, renderer().render))).toBe("INVALID_LAYOUT");
  });

  it("freezeLayout copies only present keys", () => {
    const { core } = make();
    core.forRemote("react").setLayout({
      breadcrumbs: [{ label: "Home" }],
      actions: [{ id: "x", label: "X", onSelect: () => {} }],
    });
    const layout = core.getView().layout!;
    expect(Object.keys(layout)).toEqual(["breadcrumbs", "actions"]);
    expect(Object.keys(layout.breadcrumbs![0]!)).toEqual(["label"]);
    expect(Object.keys(layout.actions![0]!)).toEqual(["id", "label", "onSelect"]);
    core.forRemote("vue").setLayout({ title: "T" });
    core.navigate("/summary");
    expect(Object.keys(core.getView().layout!)).toEqual(["title"]);
  });

  it("revoke notifies once", () => {
    const { core } = make();
    core.attachSlotElement("header", fakeEl());
    core.attachSlotElement("sidebar", fakeEl());
    const react = core.forRemote("react");
    react.setLayout({ title: "A" });
    react.claimSlot("header", renderer().render);
    react.claimSlot("sidebar", renderer().render);
    const onChange = vi.fn();
    core.subscribe(onChange);
    core.revoke("react");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("dispose cleans every slot, empties elements, revokes facades and clears layouts", () => {
    const { core, session } = make();
    const el = fakeEl();
    core.attachSlotElement("header", el);
    const react = core.forRemote("react");
    react.setLayout({ title: "A" });
    const { render, cleanup } = renderer();
    react.claimSlot("header", render);
    const vue = core.forRemote("vue");
    vue.claimSlot("sidebar", () => {
      throw new Error("never attached");
    });
    core.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(el.nodes).toEqual([]);
    expect(core.getView().layout).toBeNull();
    expect(code(() => react.setLayout({ title: "B" }))).toBe("FACADE_REVOKED");
    expect(code(() => vue.navigate("/summary"))).toBe("FACADE_REVOKED");
    expect(session.listeners.size).toBe(0);
  });
});

const ctx = { fromRevision: 1, toRevision: 2, reason: "account-change" } as never;
function fakeLifecycle() {
  const calls: string[] = [];
  const lifecycle = {
    prepareTransition: vi.fn(async (_c: unknown) => void calls.push("prepare")),
    resetIdentityState: vi.fn(async (_c: unknown) => void calls.push("reset")),
    resume: vi.fn(async (_c: unknown) => void calls.push("resume")),
    block: vi.fn((_r: unknown) => void calls.push("block")),
    dispose: vi.fn(() => void calls.push("dispose")),
  };
  return { lifecycle, calls };
}
const authed = (rev: number) =>
  ({ status: "authenticated", subjectId: "user_ava", accountId: `a${rev}`, contextRevision: rev }) as SessionSnapshot;

/** runtime with a react remote that holds the header slot and a layout */
function transitionSetup() {
  const session = fakeSession(authed(1));
  const runtime = createShellRuntime({ session: session.api, routes, resolveUser });
  const el = fakeEl();
  runtime.attachSlotElement("header", el);
  const shell = runtime.forRemote("react");
  const { lifecycle, calls } = fakeLifecycle();
  const wrapper = runtime.registerRemote("react", lifecycle);
  shell.setLayout({ title: "A" });
  const r = renderer();
  const render = vi.fn((e: HTMLElement) => {
    calls.push("render");
    return r.render(e);
  });
  shell.claimSlot("header", render);
  return { session, runtime, el, shell, lifecycle, calls, wrapper, render, cleanup: r.cleanup };
}

describe("transitions and lifecycle wrapper", () => {
  it("transitioning clears layout, cleans the slot once, keeps the claim, truncates path", () => {
    const t = transitionSetup();
    t.runtime.forRemote("vue").setLayout({ title: "B" });
    t.shell.navigate("/orders/ord_1");
    t.session.set({ status: "transitioning", contextRevision: 2 });
    expect(t.runtime.getView().layout).toBeNull();
    expect(t.cleanup).toHaveBeenCalledTimes(1);
    expect(t.el.nodes).toEqual([]);
    expect(t.runtime.getState().path).toBe("/orders");
    expect(code(() => t.runtime.forRemote("vue").claimSlot("header", renderer().render))).toBe("SLOT_TAKEN");
  });

  it("a path already at its root stays; view is rebuilt even when the path is unchanged", () => {
    const t = transitionSetup();
    t.runtime.forRemote("vue").setLayout({ title: "B" });
    t.shell.navigate("/summary");
    expect(t.runtime.getView().layout?.title).toBe("B");
    t.session.set({ status: "transitioning", contextRevision: 2 });
    expect(t.runtime.getState().path).toBe("/summary");
    expect(t.runtime.getView().layout).toBeNull();
  });

  it("repeated transitioning snapshots are idempotent", () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    expect(() => t.session.set({ status: "transitioning", contextRevision: 3 })).not.toThrow();
    expect(t.cleanup).toHaveBeenCalledTimes(1);
  });

  it("wrapper resume delegates first, then renders the slot again", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.session.set(authed(2));
    expect(t.render).toHaveBeenCalledTimes(1);
    await t.wrapper.resume(ctx);
    expect(t.lifecycle.resume).toHaveBeenCalledWith(ctx);
    expect(t.calls).toEqual(["render", "resume", "render"]);
    expect(t.el.nodes).toEqual(["content"]);
  });

  it("resume while still transitioning does not render", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    await t.wrapper.resume(ctx);
    expect(t.render).toHaveBeenCalledTimes(1);
    expect(t.el.nodes).toEqual([]);
  });

  it("block during a transition revokes; a later resume does not render", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.wrapper.block("cleanup-failed" as never);
    expect(t.lifecycle.block).toHaveBeenCalledWith("cleanup-failed");
    expect(code(() => t.shell.setLayout({ title: "x" }))).toBe("FACADE_REVOKED");
    expect(code(() => t.runtime.forRemote("vue").claimSlot("header", renderer().render))).toBeUndefined();
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(t.render).toHaveBeenCalledTimes(1);
  });

  it("block revokes before delegating", () => {
    const t = transitionSetup();
    t.lifecycle.block.mockImplementation(() => {
      expect(code(() => t.shell.setLayout({ title: "x" }))).toBe("FACADE_REVOKED");
    });
    t.wrapper.block("x" as never);
    expect(t.lifecycle.block).toHaveBeenCalledTimes(1);
    expect(t.cleanup).toHaveBeenCalledTimes(1);
  });

  it("a blocked remote stays out even if a new facade claims before re-registering", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.wrapper.block("x" as never);
    const { render } = renderer();
    t.runtime.forRemote("react").claimSlot("header", render);
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(render).not.toHaveBeenCalled();
    expect(t.el.nodes).toEqual([]);
  });

  it("unregisterRemote during a transition; a late resume does not render", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.runtime.unregisterRemote("react");
    expect(code(() => t.shell.claimSlot("sidebar", renderer().render))).toBe("FACADE_REVOKED");
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(t.render).toHaveBeenCalledTimes(1);
    expect(t.el.nodes).toEqual([]);
  });

  it("a stale wrapper after re-register does not render the new mount's claims", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.runtime.registerRemote("react", fakeLifecycle().lifecycle);
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(t.render).toHaveBeenCalledTimes(1);
  });

  it("a stale wrapper's block or dispose does not revoke the new mount", () => {
    const t = transitionSetup();
    t.runtime.unregisterRemote("react");
    const fresh = t.runtime.forRemote("react");
    const next = fakeLifecycle();
    t.runtime.registerRemote("react", next.lifecycle);
    t.wrapper.block("x" as never);
    t.wrapper.dispose();
    expect(t.lifecycle.block).toHaveBeenCalledTimes(1);
    expect(t.lifecycle.dispose).toHaveBeenCalledTimes(1);
    expect(code(() => fresh.setLayout({ title: "new" }))).toBeUndefined();
    expect(t.runtime.getView().layout?.title).toBe("new");
  });

  it("setLayout from a path listener during the transition is dropped; layout set in resume shows", async () => {
    const t = transitionSetup();
    t.shell.navigate("/orders/ord_1");
    let lastPath = t.shell.getState().path;
    t.shell.subscribe(() => {
      const { path } = t.shell.getState();
      if (path === lastPath) return;
      lastPath = path;
      t.shell.setLayout({ title: `Order ${path}` });
    });
    t.session.set({ status: "transitioning", contextRevision: 2 });
    expect(t.runtime.getState().path).toBe("/orders");
    expect(t.runtime.getView().layout).toBeNull();
    expect(() => t.shell.setLayout({ title: "old" })()).not.toThrow();
    expect(t.runtime.getView().layout).toBeNull();
    expect(code(() => t.shell.setLayout({ title: 1 as never }))).toBe("INVALID_LAYOUT");
    t.session.set(authed(2));
    t.lifecycle.resume.mockImplementationOnce(async () => {
      t.shell.setLayout({ title: "fresh" });
    });
    await t.wrapper.resume(ctx);
    expect(t.runtime.getView().layout?.title).toBe("fresh");
  });

  it("facade navigate while transitioning keeps only the route root; language is unaffected", () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.shell.navigate("/orders/ord_1");
    expect(t.runtime.getState().path).toBe("/orders");
    t.shell.navigate("/summary");
    expect(t.runtime.getState().path).toBe("/summary");
    expect(code(() => t.shell.navigate("/nope"))).toBe("INVALID_PATH");
    t.shell.setLanguage("th");
    expect(t.runtime.getState().language).toBe("th");
    t.session.set(authed(2));
    t.shell.navigate("/orders/ord_2");
    expect(t.runtime.getState().path).toBe("/orders/ord_2");
  });

  it("remount (unregister, forRemote, then registerRemote) renders the new claim after resume", async () => {
    const t = transitionSetup();
    t.runtime.unregisterRemote("react");
    const fresh = t.runtime.forRemote("react");
    const next = fakeLifecycle();
    const wrapper2 = t.runtime.registerRemote("react", next.lifecycle);
    const { render } = renderer();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    fresh.claimSlot("header", render);
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(render).not.toHaveBeenCalled();
    await wrapper2.resume(ctx);
    expect(render).toHaveBeenCalledWith(t.el);
  });

  it("a transition ending in error leaves the slot empty, even when an element is re-attached", () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.session.set({ status: "error", contextRevision: 2 } as SessionSnapshot);
    expect(t.el.nodes).toEqual([]);
    t.runtime.attachSlotElement("header", null);
    t.runtime.attachSlotElement("header", fakeEl());
    expect(t.render).toHaveBeenCalledTimes(1);
  });

  it("attaching an element or claiming during a transition does not render", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    const el2 = fakeEl();
    t.runtime.attachSlotElement("header", el2);
    expect(t.render).toHaveBeenCalledTimes(1);
    const side = fakeEl();
    t.runtime.attachSlotElement("sidebar", side);
    const { render } = renderer();
    t.shell.claimSlot("sidebar", render);
    expect(render).not.toHaveBeenCalled();
    t.session.set(authed(2));
    await t.wrapper.resume(ctx);
    expect(el2.nodes).toEqual(["content"]);
    expect(render).toHaveBeenCalledWith(side);
  });

  it("wrapper delegates prepareTransition, resetIdentityState and dispose; rejections propagate", async () => {
    const t = transitionSetup();
    await t.wrapper.prepareTransition(ctx);
    await t.wrapper.resetIdentityState(ctx);
    expect(t.lifecycle.prepareTransition).toHaveBeenCalledWith(ctx);
    expect(t.lifecycle.resetIdentityState).toHaveBeenCalledWith(ctx);
    const err = new Error("reset failed");
    t.lifecycle.resetIdentityState.mockRejectedValueOnce(err);
    await expect(t.wrapper.resetIdentityState(ctx)).rejects.toBe(err);
    t.lifecycle.dispose.mockImplementation(() => {
      expect(code(() => t.shell.setLayout({ title: "x" }))).toBe("FACADE_REVOKED");
    });
    t.wrapper.dispose();
    expect(t.lifecycle.dispose).toHaveBeenCalledTimes(1);
    expect(t.cleanup).toHaveBeenCalledTimes(1);
  });

  it("a rejected delegate resume propagates and does not render", async () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    t.session.set(authed(2));
    const err = new Error("resume failed");
    t.lifecycle.resume.mockRejectedValueOnce(err);
    await expect(t.wrapper.resume(ctx)).rejects.toBe(err);
    expect(t.render).toHaveBeenCalledTimes(1);
  });

  it("navigate and setLanguage during a transition do not throw, re-render or touch contextRevision", () => {
    const t = transitionSetup();
    t.session.set({ status: "transitioning", contextRevision: 2 });
    expect(() => t.shell.navigate("/summary")).not.toThrow();
    expect(() => t.shell.setLanguage("th")).not.toThrow();
    expect(t.render).toHaveBeenCalledTimes(1);
    expect(t.el.nodes).toEqual([]);
    expect(t.session.api.getSnapshot().contextRevision).toBe(2);
  });
});

describe("final review fixes", () => {
  it("notify isolates a throwing listener: later listeners still run", () => {
    const { core } = make();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const later = vi.fn();
    core.subscribe(() => {
      throw new Error("remote listener bug");
    });
    core.subscribe(later);
    expect(() => core.navigate("/summary")).not.toThrow();
    expect(later).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("state user is a frozen copy of the resolver's shared object", () => {
    const shared = { subjectId: "user_ava", displayName: "Ava" };
    const session = fakeSession({ status: "authenticated", subjectId: "user_ava", accountId: "acct_north", contextRevision: 1 });
    const core = createShellCore({ session: session.api, routes, resolveUser: () => shared });
    const user = core.getState().user!;
    expect(user).toEqual(shared);
    expect(Object.isFrozen(user)).toBe(true);
    expect(() => {
      (user as { displayName: string }).displayName = "Mallory";
    }).toThrow(TypeError);
    expect(shared.displayName).toBe("Ava");
  });
});
