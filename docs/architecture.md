# Architecture

Session-coordination POC: a Modern.js shell owns identity transitions and injects a framework-neutral `SessionApi` into Module Federation remotes. Remotes keep their own data clients. This is **not** production authentication.

Related: [DI decision](decisions/001-session-di.md) · [limitations](limitations.md) · [AGENTS.md](../AGENTS.md)

## Package map

| Package / app | Role |
| --- | --- |
| `@poc/platform-contracts` | Types + small validators only. No store instances. Remotes depend on this package for session/lifecycle types. |
| `@poc/remote-kit` | Remote-side host kit: `resolveSession`, `createMountHandle`, Rsbuild/MF factories, React/Vue session hooks. Shells must not import it. |
| `@poc/session-coordinator` | Shell-internal Zustand vanilla coordinator + remote registry. Remotes must not import it. |
| `@poc/shell-host` | Shell-internal host kit: remotes catalog, MF/Modern.js config factories, coordinator bootstrap. Remotes must not import it. |
| `@poc/shared-session-store` | DI **C** only — package-level singleton anti-pattern. |
| `@poc/shell-ui` | Shared debug UI: session panel, `RemoteHost`, scenario controls, event log. |
| `@poc/test-support` | Fictional fixtures + `MockApiControls` for deterministic delays/failures. |
| `apps/shell-injected` | DI **A** baseline host (`:8090`). |
| `apps/shell-federated` | DI **B** host (`:8091`); exposes `./session` (`getSessionApi`). |
| `apps/shell-zustand` | DI **C** host (`:8092`); imports shared store. |
| `apps/remote-react` | Rsbuild MF remote (`:5001`); TanStack Query + REST orders. |
| `apps/remote-vue` | Rsbuild MF remote (`:5002`); Apollo Client core + GraphQL summary. |
| `apps/mock-api` | Fictional Express backend (`:4010`); session/REST/GraphQL/`__controls`. |

### Dependency directions

```mermaid
flowchart LR
  subgraph contracts["Contracts"]
    PC["@poc/platform-contracts"]
  end

  subgraph shellInternal["Shell-internal"]
    SC["@poc/session-coordinator"]
    SH["@poc/shell-host"]
    SU["@poc/shell-ui"]
    SS["@poc/shared-session-store\n(DI C only)"]
  end

  subgraph hosts["Hosts"]
    A["shell-injected A"]
    B["shell-federated B"]
    C["shell-zustand C"]
  end

  subgraph remotes["Remotes"]
    RK["@poc/remote-kit"]
    RR["remote-react"]
    RV["remote-vue"]
  end

  API["mock-api"]
  TS["@poc/test-support"]

  SC --> PC
  SH --> PC
  SH --> SC
  SU --> PC
  SU --> SC
  SU --> TS
  SS --> SC
  A --> SU
  A --> SH
  B --> SU
  B --> SH
  C --> SU
  C --> SH
  C --> SS
  RK --> PC
  RR --> PC
  RR --> RK
  RV --> PC
  RV --> RK
  A -.->|MF mount| RR
  A -.->|MF mount| RV
  B -.->|MF mount| RR
  B -.->|MF mount| RV
  C -.->|MF mount| RR
  C -.->|MF mount| RV
  A -->|AuthBridge / data headers| API
  RR -->|REST| API
  RV -->|GraphQL| API
```

Remotes must not import `@poc/session-coordinator`, `@poc/shell-host`, or shell apps. Their platform dependencies are `@poc/platform-contracts` and `@poc/remote-kit`. Shells must not import `@poc/remote-kit`.

## Ownership diagram

```mermaid
flowchart TB
  subgraph shell["Shell instance — Modern.js CSR"]
    direction TB
    COORD["createSessionCoordinator({ auth })"]
    STORE["Zustand vanilla store\n(private)"]
    SNAP["Frozen SessionSnapshot refs"]
    REG["RemoteRegistry + blocked set"]
    API["SessionApi\ncontractVersion = 1"]

    COORD --> STORE
    COORD --> SNAP
    COORD --> REG
    COORD --> API

    UI["@poc/shell-ui ShellApp"]
    RH["RemoteHost"]
    UI --> RH
    UI --> API
    RH -->|register lifecycle| REG
  end

  subgraph remotes["Federated remotes"]
    RR["remote-react\nQueryClient owned\nkeys: account + revision"]
    RV["remote-vue\nApolloClient owned\nrecreate on identity reset"]
  end

  MOCK["mock-api :4010\n/api/session · /api/orders · /graphql · /__controls"]

  RH -->|import mount + inject capabilities| RR
  RH -->|import mount + inject capabilities| RV
  API -.->|subscribe / commands| RR
  API -.->|subscribe / commands| RV
  COORD -->|AuthBridge| MOCK
  RR -->|x-poc-session / x-poc-account| MOCK
  RV -->|x-poc-session / x-poc-account| MOCK
```

ASCII sketch (same boundaries):

```
┌──────────────────────────────────────────────────────────────────────┐
│ Shell instance (Modern.js CSR)                                       │
│  shell-host · coordinator · registry · SessionApi · shell-ui         │
│   ┌─────────────────────────┐   ┌─────────────────────────┐          │
│   │ remote-react            │   │ remote-vue              │          │
│   │ QueryClient (owned)     │   │ ApolloClient (owned)    │          │
│   └─────────────────────────┘   └─────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
                    │ x-poc-session / x-poc-account
                    ▼
         mock-api :4010 (fictional scope enforcement)
```

### Ownership rules

- **Exactly one coordinator per browser shell instance.** Constructed in the shell app; not shared via browser globals as the primary DI path.
- **Domain data stays in remote-owned caches.** Do not mirror full API responses into a universal Zustand store.
- **Instance identity**
  - **A:** shell constructs API → passes `session` at mount.
  - **B:** same shell-owned API; remotes receive `resolveSession: () => getSessionApi()` (host also exposes federated `./session` for comparison).
  - **C:** package singleton — intentional coupling demo only.

### DI styles at a glance

```mermaid
flowchart LR
  subgraph A["A — Injected baseline"]
    SA["Shell coordinator"] -->|mount el, session| RA["Remote"]
  end

  subgraph B["B — Federated accessor"]
    SB["Shell coordinator"] --> GB["getSessionApi\nMF expose ./session"]
    SB -->|mount el, resolveSession| RB["Remote"]
    RB -.->|optional| GB
  end

  subgraph C["C — Shared Zustand anti-pattern"]
    PKG["@poc/shared-session-store\nsingleton"] --> SC["Shell"]
    PKG -.->|can import directly| RC["Remote"]
    SC -->|mount el, session| RC
  end
```

See [001-session-di.md](decisions/001-session-di.md) for tradeoffs. **A** is the baseline; **C** is intentionally wrong for production.

## Public session contract

```ts
type SessionStatus =
  | "initializing"
  | "authenticated"
  | "anonymous"
  | "transitioning"
  | "error";

type SessionSnapshot = {
  status: SessionStatus;
  subjectId?: string;
  accountId?: string;
  contextRevision: number;
};

interface SessionApi {
  readonly contractVersion: 1;
  getSnapshot(): Readonly<SessionSnapshot>;
  subscribe(onChange: () => void): () => void;
  requestLogin(): Promise<void>;
  requestLogout(): Promise<void>;
  requestAccountChange(accountId: string): Promise<void>;
}
```

Invariants:

- Snapshot object identity is stable until state actually changes (frozen refs).
- `contractVersion` (API shape) is independent of `contextRevision` (obsolete-work marker).
- Commands resolve when the new snapshot is published; reject with `SessionCommandError` on failure, timeout, or supersession (`TRANSITION_SUPERSEDED`).
- Never expose raw Zustand stores, `setState`, tokens, or query clients through this API.
- External inputs (e.g. `accountId`) are validated at the coordinator boundary (`assertAccountId`).

`subscribe` / `getSnapshot` alone are **not** proof that remote cleanup completed. Cleanup is a separate lifecycle protocol.

### Session status state machine

```mermaid
stateDiagram-v2
  [*] --> initializing
  initializing --> anonymous: cold start publish
  anonymous --> transitioning: login / account change
  authenticated --> transitioning: logout / account change / login
  transitioning --> authenticated: auth success
  transitioning --> anonymous: logout success
  transitioning --> error: cleanup fail / timeout / auth fail
  error --> transitioning: new command
  authenticated --> authenticated: snapshot identity stable until change
```

`contextRevision` increments on every transition entry (`transitioning`), including paths that later land in `error`.

## Mount and lifecycle contract

```ts
mount(element, {
  session?,            // DI A / C
  resolveSession?,     // DI B (preferred at mount even when ./session is exposed)
  forceCleanupFail?,   // POC scenario hook
  onEvent?,            // shell diagnostics sink
}): MountHandle // { lifecycle, unmount }

interface RemoteLifecycle {
  prepareTransition(ctx: TransitionContext): Promise<void>;
  resetIdentityState(ctx: TransitionContext): Promise<void>;
  resume(ctx: TransitionContext): Promise<void>;
  block(reason: RemoteBlockReason): void;
  dispose(): void;
}

type TransitionContext = {
  fromRevision: number;
  toRevision: number;
  signal: AbortSignal;
};
```

Resolution order inside remotes: `capabilities.session ?? capabilities.resolveSession?.()`.

### Mount / registry sequence

```mermaid
sequenceDiagram
  participant UI as ShellApp / RemoteHost
  participant MF as Module Federation
  participant R as Remote mount()
  participant Reg as RemoteRegistry
  participant S as SessionApi

  UI->>MF: import("reactRemote/mount")
  MF-->>UI: mount export
  UI->>R: mount(el, capabilities)
  R->>S: getSnapshot / subscribe
  R-->>UI: MountHandle { lifecycle, unmount }
  UI->>Reg: register(id, lifecycle)

  Note over UI,R: Later unmount
  UI->>Reg: unregister(id)
  UI->>R: unmount() / dispose()
```

### Registry behavior

1. `RemoteHost` dynamically imports the federated `./mount` export.
2. On success: `registry.register(id, handle.lifecycle)`.
3. On unmount/dispose: `registry.unregister(id)` then `handle.unmount()` / `lifecycle.dispose()`.
4. Late mount during `transitioning`: remote may register and observe the transitioning snapshot; it stays gated until `resume` or `block`.
5. Blocked remotes are skipped for subsequent prepare/reset/resume until remount clears the blocked set via re-register.

### Module Federation wiring

```mermaid
flowchart LR
  subgraph build["Build / load"]
    SH["Modern.js shell\n@module-federation/modern-js-v3"]
    RR["Rsbuild remote-react\nexpose ./mount"]
    RV["Rsbuild remote-vue\nexpose ./mount"]
  end

  SH -->|mf-manifest.json :5001| RR
  SH -->|mf-manifest.json :5002| RV
  SH -.->|shared singleton eager\nreact / react-dom| RR
```

- Remotes: Rsbuild + `@module-federation/rsbuild-plugin`, expose `./mount`.
- Shells: Modern.js v3 + `@module-federation/modern-js-v3`, consume remotes via `mf-manifest.json`.
- Host shares `react` / `react-dom` as **singleton + eager** so the React remote does not mount with an undefined shared scope.
- Vue is shared from the Vue remote; the shell does not need to own Vue.

## Session transition sequence

Implemented order in `@poc/session-coordinator` (single-flight `withTransition`):

```mermaid
flowchart TD
  CMD["requestLogin / requestLogout / requestAccountChange"]
  GEN["bump generation\nsupersede prior command"]
  PUB1["publish transitioning\ncontextRevision = N+1"]
  PREP["prepareTransition ctx\nparallel non-blocked remotes"]
  RESET["resetIdentityState ctx\nparallel clear/recreate caches"]
  AUTH["AuthBridge → mock-api"]
  PUB2["publish authenticated or anonymous\nsame revision N+1"]
  RESUME["resume ctx\nnon-blocked remotes only"]
  FAIL["publish error + reject command"]
  BLOCK["block affected remote\ncleanup_failed / timeout"]

  CMD --> GEN --> PUB1 --> PREP --> RESET
  RESET -->|ok| AUTH
  RESET -->|throws| BLOCK --> FAIL
  AUTH -->|ok| PUB2 --> RESUME
  AUTH -->|fail| FAIL
  PUB1 -.->|timeout budget| FAIL
```

```mermaid
sequenceDiagram
  participant App as Shell UI
  participant Coord as SessionCoordinator
  participant Reg as Remotes in registry
  participant Auth as AuthBridge / mock-api

  App->>Coord: requestAccountChange(acct_south)
  Coord->>Coord: generation++ / supersede prior
  Coord->>App: snapshot transitioning rev=N+1
  par Remote cleanup
    Coord->>Reg: prepareTransition(ctx)
    Coord->>Reg: resetIdentityState(ctx)
  end
  alt cleanup throws
    Coord->>Reg: block(cleanup_failed)
    Coord->>App: snapshot error
  else cleanup ok
    Coord->>Auth: changeAccount
    Auth-->>Coord: { subjectId, accountId }
    Coord->>App: snapshot authenticated rev=N+1
    Coord->>Reg: resume(ctx) for non-blocked
  end
```

Notes on this ordering:

- Revision advances **before** remote cleanup so in-flight responses can detect obsolescence immediately.
- Remotes reset **before** auth confirmation so old-account cache contents cannot remain visible while waiting on mock-api. If auth then fails, the shell publishes `error` at the new revision rather than resuming old data.
- Default transition budget: `transitionTimeoutMs` (3000ms). Timeout aborts the signal, blocks remaining remotes with `timeout`, publishes `error`, and rejects the command.
- Competing commands: only the latest generation wins; superseded callers reject with `TRANSITION_SUPERSEDED`.
- Remote lifecycle phases are serialized across transitions via an internal promise chain so prepare/reset/resume from different generations do not interleave unsafely.

### Competing commands

```mermaid
sequenceDiagram
  participant U as UI
  participant C as Coordinator

  U->>C: requestLogin (gen=1)
  Note over C: transitioning…
  U->>C: requestAccountChange (gen=2)
  C-->>U: gen=1 rejects TRANSITION_SUPERSEDED
  Note over C: gen=2 owns the flight
```

### Fail-closed policy

| Failure | Behavior |
| --- | --- |
| `resetIdentityState` throws | That remote is `block({ type: "cleanup_failed" })`; command fails; no resume with old data |
| Transition timeout | Non-blocked remotes blocked as `timeout`; snapshot → `error` |
| Auth bridge / other failure | Snapshot → `error` at the transition revision; command rejects |
| Supersession | Prior command rejects; winner continues |

```mermaid
flowchart LR
  subgraph ok["Happy path"]
    T1["transitioning"] --> A1["authenticated / anonymous"]
    A1 --> R1["resume remotes"]
  end

  subgraph closed["Fail closed"]
    T2["transitioning"] --> E1["error"]
    E1 --> B1["block remotes\nno stale resume"]
  end
```

## Auth bridge and mock-api

The coordinator depends on an injected `AuthBridge`, not on Express directly:

```ts
type AuthBridge = {
  login(): Promise<{ subjectId: string; accountId: string }>;
  logout(): Promise<void>;
  changeAccount(accountId: string): Promise<{ subjectId: string; accountId: string }>;
};
```

Shell A/B use `@poc/shell-host` `createCoordinatorHost()` / `createMockAuthBridge()` → `POST /api/session/{login,logout,account}`.

Fictional identities:

| subjectId | accountId |
| --- | --- |
| `user_ava` | `acct_north` |
| `user_beau` | `acct_south` |

Account switch maps to the owning subject (each account has one fictional owner).

### Request-scope data path

```mermaid
sequenceDiagram
  participant R as Remote
  participant S as Session snapshot
  participant M as mock-api

  R->>S: read subjectId + accountId + revision
  R->>M: GET /api/orders or POST /graphql
  Note over R,M: headers x-poc-session, x-poc-account
  alt headers missing or mismatched owner
    M-->>R: 403
  else scope ok
    M-->>R: fictional domain payload
    R->>S: drop if contextRevision changed
  end
```

Data routes (`/api/orders`, `/graphql`) require matching `x-poc-session` + `x-poc-account` headers and reject cross-account access with HTTP 403. Client-sent account id alone is **not** authorization — the POC only demonstrates request-scope checks.

`/__controls` provides deterministic delay, fail-next, and cleanup-fail toggles for tests/UI scenarios (also applied to session routes so transition failures are reproducible).

## Remote data-client decisions

### React + TanStack Query

- One `QueryClient` per mount; cleared on identity reset / block / dispose.
- Query keys include `accountId` + `contextRevision`.
- Fetch uses `AbortSignal` where supported and re-checks snapshot revision before committing UI data.
- Session subscription via `useSyncExternalStore`.
- Local feature state (draft note) resets on identity reset/block.

```mermaid
flowchart LR
  SUB["session.subscribe"] --> RENDER["React render"]
  RENDER --> QK["queryKey\norders, accountId, revision"]
  QK --> FETCH["fetch + AbortSignal"]
  FETCH --> CHK{revision still current?}
  CHK -->|yes| UI["show orders"]
  CHK -->|no| DROP["drop / abort"]
  RESET["resetIdentityState"] --> CLEAR["queryClient.clear\n+ draft reset"]
```

### Vue + Apollo Client core

- Framework-neutral `@apollo/client` (no React Apollo).
- On `resetIdentityState`, **recreate** `ApolloClient` + `InMemoryCache` bound to the new identity headers.
- Why not `clearStore` / `resetStore` alone: clearing cache does not reliably cancel or isolate in-flight network/response races tied to the previous client instance; a new client+cache makes old observers unreachable.
- Results captured under an obsolete `contextRevision` are dropped in the view layer.
- Local draft state resets with identity.

```mermaid
flowchart TD
  M["mount"] --> C1["ApolloClient #1 + InMemoryCache"]
  C1 --> Q1["query accountSummary"]
  RESET["resetIdentityState"] --> STOP["stop old client"]
  RESET --> C2["ApolloClient #2 + new cache"]
  C2 --> Q2["query under new headers"]
  Q1 -.->|obsolete revision| DROP["drop result"]
```

### Mutation / invalidation policy

- Transitions do **not** wait for in-flight mutations.
- A mutation accepted by the server may complete under the original revision.
- Never auto-retry an old-account mutation under a new account.
- Domain invalidation hints (when present) are refresh signals only — not authoritative records; late-mounted remotes must fetch current data.

```mermaid
sequenceDiagram
  participant R as Remote rev=N
  participant M as mock-api
  participant C as Coordinator

  R->>M: mutation under account A / rev N
  C->>C: transition to account B / rev N+1
  Note over R,C: transition does not await mutation
  M-->>R: mutation success for rev N
  Note over R: must not auto-retry under account B
```

## Shell UI composition

Each shell renders `@poc/shell-ui` `ShellApp` with a `remotes` list from `@poc/shell-host` (`bindMount` plus a host-local `import("<mfName>/mount")`):

- DI mode label + optional banner (required for C)
- Session status, fictional user/account, context revision, contract version
- Login / logout / account switch
- Per-remote mount/unmount toggles derived from the list
- Scenario controls (delay, fail-next, force cleanup failure)
- Bounded event/debug log (no credentials)

`forceCleanupFail` is closed over at mount time; toggling it remounts remotes so the next transition observes the flag.

```mermaid
flowchart TB
  SA["ShellApp"]
  SA --> SP["SessionPanel"]
  SA --> MC["Mount toggles"]
  SA --> RH1["RemoteHost per remotes list"]
  SA --> SC["ScenarioControls"]
  SA --> EL["EventLog"]
  SP --> API["SessionApi"]
  RH1 --> API
  SC --> CTRL["mock-api /__controls"]
```

## Runtime topology

| Process | Default URL |
| --- | --- |
| mock-api | `http://127.0.0.1:4010` |
| remote-react | `http://127.0.0.1:5001` |
| remote-vue | `http://127.0.0.1:5002` |
| shell-injected (A) | `http://localhost:8090` |
| shell-federated (B) | `http://localhost:8091` |
| shell-zustand (C) | `http://localhost:8092` |

```mermaid
flowchart LR
  Browser["Browser"]
  A["shell A :8090"]
  B["shell B :8091"]
  C["shell C :8092"]
  RR["remote-react :5001"]
  RV["remote-vue :5002"]
  API["mock-api :4010"]

  Browser --> A
  Browser --> B
  Browser --> C
  A --> RR
  A --> RV
  B --> RR
  B --> RV
  C --> RR
  C --> RV
  A --> API
  B --> API
  C --> API
  RR --> API
  RV --> API
```

Shells use 809x because some developer machines bind proxies on 8080; if Modern.js falls back from a busy configured port while asset URLs still target the original port, the UI breaks.

Start stack: `pnpm dev:poc` (mock-api + both remotes + shell A).

## Same-realm security limitations

All Module Federation remotes share the page JavaScript realm. `SessionApi` is a capability object for coordination, **not** a sandbox or trust boundary. Malicious remote code can still observe memory and network in this POC. Production multi-team remotes need additional isolation/review beyond this architecture.

```mermaid
flowchart TB
  REALM["Single browser JS realm"]
  REALM --> SHELL["Shell + SessionApi object"]
  REALM --> R1["Remote JS"]
  REALM --> R2["Remote JS"]
  R1 -.->|can observe memory / network| SHELL
  R2 -.->|not a security boundary| SHELL
```

## Intentionally excluded

- Production IdP integration / real token refresh
- Request-scoped SSR session state (would be required for production SSR)
- Native / WebView adapters
- Cross-origin iframe messaging
- Cross-tab session synchronization
- Organization-wide migration tooling / full design system
