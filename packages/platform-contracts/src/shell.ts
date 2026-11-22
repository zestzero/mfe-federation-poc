export const SHELL_CONTRACT_VERSION = 1 as const;

export type Language = "en" | "th";
export type SlotId = "header" | "sidebar";

export type ShellUser = { subjectId: string; displayName: string };
export type ShellState = {
  path: string;
  language: Language;
  /** Derived from session, read-only for remotes */
  user: ShellUser | null;
};

export type LayoutAction = {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
};
export type Breadcrumb = { label: string; path?: string };
export type LayoutSpec = {
  title?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: LayoutAction[];
};

export interface ShellApi {
  readonly contractVersion: typeof SHELL_CONTRACT_VERSION;
  /** Stable identity until a field changes */
  getState(): Readonly<ShellState>;
  subscribe(onChange: () => void): () => void;
  /** Sync; throws ShellCommandError("INVALID_PATH") */
  navigate(path: string): void;
  /** Sync; throws ShellCommandError("INVALID_LANGUAGE") */
  setLanguage(code: Language): void;
  /** Replaces this remote's spec; returns release */
  setLayout(spec: LayoutSpec): () => void;
  /** Throws SLOT_TAKEN. render may be called again after a transition */
  claimSlot(id: SlotId, render: (el: HTMLElement) => () => void): () => void;
}

export type ShellErrorCode =
  | "INVALID_PATH"
  | "INVALID_LANGUAGE"
  | "INVALID_LAYOUT"
  | "SLOT_TAKEN"
  | "FACADE_REVOKED";

export class ShellCommandError extends Error {
  readonly code: ShellErrorCode;
  constructor(code: ShellErrorCode, message: string) {
    super(message);
    this.name = "ShellCommandError";
    this.code = code;
  }
}

const PATH_PATTERN = /^\/[a-z0-9/_-]*$/;
const LANGUAGES: readonly string[] = ["en", "th"];
const MAX_ACTIONS = 5;
const MAX_BREADCRUMBS = 6;
const MAX_LABEL = 40;

/** Pattern check only; the route table check is the shell runtime's job. */
export function assertPath(path: string): string {
  if (typeof path === "string" && PATH_PATTERN.test(path)) return path;
  throw new ShellCommandError("INVALID_PATH", `Invalid path: ${String(path)}`);
}

export function assertLanguage(code: string): Language {
  if (LANGUAGES.includes(code)) return code as Language;
  throw new ShellCommandError("INVALID_LANGUAGE", `Unknown language: ${String(code)}`);
}

export function validateLayoutSpec(spec: LayoutSpec): LayoutSpec {
  const bad = (msg: string): never => {
    throw new ShellCommandError("INVALID_LAYOUT", msg);
  };
  const label = (v: unknown, what: string) => {
    if (typeof v !== "string" || v.length > MAX_LABEL) {
      bad(`${what} must be a string of at most ${MAX_LABEL} characters`);
    }
  };
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (!isObject(spec)) bad("layout spec must be an object");
  if (spec.title !== undefined && typeof spec.title !== "string") bad("title must be a string");
  if (spec.breadcrumbs !== undefined) {
    if (!Array.isArray(spec.breadcrumbs) || spec.breadcrumbs.length > MAX_BREADCRUMBS) {
      bad(`at most ${MAX_BREADCRUMBS} breadcrumbs`);
    }
    for (const b of spec.breadcrumbs) {
      if (!isObject(b)) bad("breadcrumb must be an object");
      label(b.label, "breadcrumb label");
      if (b.path !== undefined && typeof b.path !== "string") bad("breadcrumb path must be a string");
    }
  }
  if (spec.actions !== undefined) {
    if (!Array.isArray(spec.actions) || spec.actions.length > MAX_ACTIONS) {
      bad(`at most ${MAX_ACTIONS} actions`);
    }
    for (const a of spec.actions) {
      if (!isObject(a)) bad("action must be an object");
      label(a.label, "action label");
      if (typeof a.id !== "string") bad("action id must be a string");
    }
  }
  return spec;
}
