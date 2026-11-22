import { createStore } from "zustand/vanilla";
import {
  SHELL_CONTRACT_VERSION,
  ShellCommandError,
  assertLanguage,
  assertPath,
  validateLayoutSpec,
  type Language,
  type LayoutSpec,
  type RemoteLifecycle,
  type SessionApi,
  type SessionSnapshot,
  type ShellApi,
  type ShellState,
  type ShellUser,
  type SlotId,
} from "@poc/platform-contracts";

export type ShellView = { activeRemoteId: string | null; layout: LayoutSpec | null };

export type ShellRuntimeOptions = {
  session: SessionApi;
  /** path prefix -> remoteId */
  routes: Record<string, string>;
  resolveUser(subjectId: string): ShellUser | null;
  /** default "/orders" */
  initialPath?: string;
};

export interface ShellRuntime {
  getState(): Readonly<ShellState>;
  getView(): Readonly<ShellView>;
  /** Notified on any state or view change */
  subscribe(onChange: () => void): () => void;
  forRemote(remoteId: string): ShellApi;
  registerRemote(remoteId: string, lifecycle: RemoteLifecycle): RemoteLifecycle;
  unregisterRemote(remoteId: string): void;
  attachSlotElement(id: SlotId, el: HTMLElement | null): void;
  /** Same validation as ShellApi.navigate, for the shell UI */
  shellNavigate(path: string): void;
  /** Same validation as ShellApi.setLanguage */
  shellSetLanguage(code: Language): void;
  dispose(): void;
}

type InternalState = { state: ShellState; view: ShellView };
type LayoutEntry = { spec: LayoutSpec };
type SlotClaim = {
  remoteId: string;
  render: (el: HTMLElement) => () => void;
  cleanup?: () => void;
  rendered: boolean;
  /**
   * Set on `transitioning`; only that remote's wrapper `resume` clears it. A held claim never renders.
   * A claim from a facade whose remote never registered stays held until released or revoked (fails closed).
   */
  held: boolean;
};
type FacadeToken = { revoked: boolean };
type Registration = { blocked: boolean };

const SLOT_IDS: readonly string[] = ["header", "sidebar"];

/** Frozen copy of the listed keys that are present (not undefined). */
const pick = <T extends object>(o: T, keys: readonly (keyof T)[]): T =>
  Object.freeze(Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))) as T;

/** Deep frozen copy of the known fields only, so later mutation of the caller's spec cannot reach the view. */
const freezeLayout = (spec: LayoutSpec): LayoutSpec =>
  pick(
    {
      title: spec.title,
      breadcrumbs: spec.breadcrumbs && Object.freeze(spec.breadcrumbs.map((b) => pick(b, ["label", "path"]))),
      actions: spec.actions && Object.freeze(spec.actions.map((a) => pick(a, ["id", "label", "disabled", "onSelect"]))),
    } as LayoutSpec,
    ["title", "breadcrumbs", "actions"],
  );

/** Internal: state, navigation, language, view, per-remote facades, layout and slots. */
export function createShellCore(options: ShellRuntimeOptions) {
  const { session, routes, resolveUser } = options;
  const prefixes = Object.keys(routes).sort((a, b) => b.length - a.length);
  const matchRoute = (path: string) =>
    prefixes.find((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const remoteIdFor = (path: string) => {
    const prefix = matchRoute(path);
    return prefix === undefined ? null : routes[prefix]!;
  };

  const userFrom = (snapshot: SessionSnapshot): ShellUser | null => {
    if (snapshot.status !== "authenticated" || snapshot.subjectId === undefined) return null;
    const user = resolveUser(snapshot.subjectId);
    // frozen copy: the resolver may hand out a shared object (FICTIONAL_USERS)
    return user ? Object.freeze({ ...user }) : null;
  };
  const sameUser = (a: ShellUser | null, b: ShellUser | null) =>
    a === b || (a !== null && b !== null && a.subjectId === b.subjectId && a.displayName === b.displayName);

  const layouts = new Map<string, LayoutEntry>();
  const makeView = (path: string): ShellView => {
    const activeRemoteId = remoteIdFor(path);
    const layout = (activeRemoteId === null ? undefined : layouts.get(activeRemoteId)?.spec) ?? null;
    return Object.freeze({ activeRemoteId, layout });
  };
  const initialPath = assertPath(options.initialPath ?? "/orders");
  const makeState = (path: string, language: Language, user: ShellUser | null): ShellState =>
    Object.freeze({ path, language, user });

  const initialSnapshot = session.getSnapshot();
  /** Cached from the session subscription so commands never read the session. */
  let transitioning = initialSnapshot.status === "transitioning";
  const store = createStore<InternalState>(() => ({
    state: makeState(initialPath, "en", userFrom(initialSnapshot)),
    view: makeView(initialPath),
  }));
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // one remote's listener must not skip the others (or the shell's own)
        console.error("[shell-state] listener failed", error);
      }
    }
  };

  /**
   * Applies state changes and rebuilds the view; state and view identity are kept when nothing in them changed.
   * Notifies once when either changed, or when `force` is set (slot claims changed).
   */
  const patch = (next: Partial<ShellState> = {}, force = false) => {
    const { state, view } = store.getState();
    const path = next.path ?? state.path;
    const language = next.language ?? state.language;
    const user = next.user === undefined || sameUser(next.user, state.user) ? state.user : next.user;
    const stateSame = path === state.path && language === state.language && user === state.user;
    const candidate = makeView(path);
    const viewSame = candidate.activeRemoteId === view.activeRemoteId && candidate.layout === view.layout;
    if (!stateSame || !viewSame) {
      store.setState({
        state: stateSame ? state : makeState(path, language, user),
        view: viewSame ? view : candidate,
      });
    } else if (!force) return;
    notify();
  };

  const navigate = (path: string) => {
    assertPath(path);
    if (matchRoute(path) === undefined) {
      throw new ShellCommandError("INVALID_PATH", `No route for path: ${path}`);
    }
    // ids in a path belong to the old account while transitioning: keep only the route root
    patch({ path: transitioning ? matchRoute(path) : path });
  };
  const setLanguage = (code: Language) => patch({ language: assertLanguage(code) });

  const claims = new Map<SlotId, SlotClaim>();
  const elements = new Map<SlotId, HTMLElement>();
  /** Renders a live claim into its element. Returns false when a throwing render dropped the claim. */
  const renderClaim = (id: SlotId): boolean => {
    const claim = claims.get(id);
    const el = elements.get(id);
    if (!claim || !el || claim.rendered || claim.held) return true;
    try {
      const cleanup = claim.render(el);
      claim.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      claim.rendered = true;
      return true;
    } catch {
      el.replaceChildren();
      claims.delete(id);
      return false;
    }
  };
  /** Runs cleanup (contained) and empties the element; the claim itself is kept. */
  const clearSlot = (id: SlotId) => {
    const claim = claims.get(id);
    if (claim?.rendered) {
      claim.rendered = false;
      try {
        claim.cleanup?.();
      } catch {
        // contained: the element is emptied below regardless
      }
      claim.cleanup = undefined;
    }
    elements.get(id)?.replaceChildren();
  };
  const dropClaim = (id: SlotId) => {
    clearSlot(id);
    claims.delete(id);
  };
  const releaseClaim = (id: SlotId, claim: SlotClaim) => {
    if (claims.get(id) !== claim) return;
    dropClaim(id);
    notify();
  };

  const attachSlotElement = (id: SlotId, el: HTMLElement | null) => {
    const previous = elements.get(id);
    if (el === (previous ?? null)) return;
    if (previous) clearSlot(id);
    if (el) elements.set(id, el);
    else elements.delete(id);
    if (!renderClaim(id)) notify();
  };

  const facades = new Map<string, FacadeToken>();
  const revoke = (remoteId: string) => {
    const token = facades.get(remoteId);
    if (token) token.revoked = true;
    facades.delete(remoteId);
    let dropped = false;
    for (const [id, claim] of claims) {
      if (claim.remoteId !== remoteId) continue;
      dropClaim(id);
      dropped = true;
    }
    layouts.delete(remoteId);
    patch({}, dropped);
  };

  const forRemote = (remoteId: string): ShellApi => {
    if (facades.has(remoteId)) revoke(remoteId);
    const token: FacadeToken = { revoked: false };
    facades.set(remoteId, token);
    const live = () => {
      if (token.revoked) throw new ShellCommandError("FACADE_REVOKED", `Facade for ${remoteId} was revoked`);
    };
    return {
      contractVersion: SHELL_CONTRACT_VERSION,
      getState: () => store.getState().state as Readonly<ShellState>,
      subscribe: (onChange) => subscribe(onChange),
      navigate(path) {
        live();
        navigate(path);
      },
      setLanguage(code) {
        live();
        setLanguage(code);
      },
      setLayout(spec) {
        live();
        const entry: LayoutEntry = { spec: freezeLayout(validateLayoutSpec(spec)) };
        // Old-context layout is dropped while transitioning; remotes re-send it in resume().
        if (transitioning) return () => {};
        layouts.set(remoteId, entry);
        patch();
        return () => {
          if (layouts.get(remoteId) !== entry) return;
          layouts.delete(remoteId);
          patch();
        };
      },
      claimSlot(id, render) {
        live();
        if (!SLOT_IDS.includes(id)) throw new ShellCommandError("INVALID_LAYOUT", `Unknown slot: ${String(id)}`);
        if (claims.has(id)) throw new ShellCommandError("SLOT_TAKEN", `Slot ${id} is already claimed`);
        const claim: SlotClaim = { remoteId, render, rendered: false, held: transitioning };
        claims.set(id, claim);
        renderClaim(id);
        notify();
        return () => releaseClaim(id, claim);
      },
    };
  };

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  };

  const registrations = new Map<string, Registration>();
  /** Wraps a remote's lifecycle so block/dispose revoke its contributions and resume re-renders its slots. */
  const registerRemote = (remoteId: string, lifecycle: RemoteLifecycle): RemoteLifecycle => {
    const reg: Registration = { blocked: false };
    registrations.set(remoteId, reg);
    /** A stale wrapper (after unregister or re-register) must not touch the current mount. */
    const current = () => registrations.get(remoteId) === reg;
    return {
      prepareTransition: (ctx) => lifecycle.prepareTransition(ctx),
      resetIdentityState: (ctx) => lifecycle.resetIdentityState(ctx),
      async resume(ctx) {
        await lifecycle.resume(ctx);
        // checked after the await: block, unregister or a new transition may land meanwhile
        if (!current() || reg.blocked || transitioning) return;
        let dropped = false;
        for (const [id, claim] of claims) {
          if (claim.remoteId !== remoteId) continue;
          claim.held = false;
          if (!renderClaim(id)) dropped = true;
        }
        if (dropped) notify();
      },
      block(reason) {
        if (current()) {
          reg.blocked = true;
          revoke(remoteId);
        }
        lifecycle.block(reason);
      },
      dispose() {
        if (current()) revoke(remoteId);
        lifecycle.dispose();
      },
    };
  };
  const unregisterRemote = (remoteId: string) => {
    registrations.delete(remoteId);
    revoke(remoteId);
  };

  const unsubscribeSession = session.subscribe(() => {
    const snapshot = session.getSnapshot();
    transitioning = snapshot.status === "transitioning";
    if (!transitioning) return patch({ user: userFrom(snapshot) });
    // Old-context contributions leave the DOM and state; claims are kept (held) for resume.
    layouts.clear();
    for (const [id, claim] of claims) {
      claim.held = true;
      clearSlot(id);
    }
    const { path } = store.getState().state;
    patch({ user: userFrom(snapshot), path: matchRoute(path) ?? path });
  });

  return {
    getState: () => store.getState().state as Readonly<ShellState>,
    getView: () => store.getState().view as Readonly<ShellView>,
    subscribe,
    navigate,
    setLanguage,
    forRemote,
    attachSlotElement,
    registerRemote,
    unregisterRemote,
    /** Internal: releases a remote's layout and slot claims and revokes its facade. */
    revoke,
    dispose() {
      for (const id of [...claims.keys()]) dropClaim(id);
      for (const el of elements.values()) el.replaceChildren();
      elements.clear();
      for (const token of facades.values()) token.revoked = true;
      facades.clear();
      registrations.clear();
      layouts.clear();
      patch();
      listeners.clear();
      unsubscribeSession();
    },
  };
}

export function createShellRuntime(options: ShellRuntimeOptions): ShellRuntime {
  const core = createShellCore(options);
  return {
    getState: core.getState,
    getView: core.getView,
    subscribe: core.subscribe,
    forRemote: core.forRemote,
    registerRemote: core.registerRemote,
    unregisterRemote: core.unregisterRemote,
    attachSlotElement: core.attachSlotElement,
    shellNavigate: core.navigate,
    shellSetLanguage: core.setLanguage,
    dispose: core.dispose,
  };
}
