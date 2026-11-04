# Architecture

One dependency rule and one injection point. Source: docs/IMPLEMENTATION_PLAN.md §11.1.

```
app/api/*           thin HTTP handlers: auth → parse → call lib → respond. No logic.
app/(pages)/*       UI. Reads through lib/queries only.
lib/collector.ts    domain: runSnapshot, freshness check, per-alliance fallback, resume logic.
lib/compute.ts      pure functions only — sums, deltas, freshness predicate, roster diff; no IO, no Date.now() (passed in).
lib/budget.ts       pure quota arithmetic (requiredQuota).
lib/sources/*.ts    adapters: v1.ts (documented API, primary), internal.ts (site API: ranks board + live-roster fallback,
                    unofficial, read-only). One output type.
lib/repo/*.ts       persistence: one module per table, plain functions over Drizzle.
lib/queries/*.ts    read models for the UI (joins, sorting, name history). Never write. Never expose BLOCKED_ROSTER_KEYS.
lib/logger.ts, lib/notify.ts, lib/env.ts, lib/redact.ts
config/alliances.ts the 20 tracked alliances, by union_id
proxy.ts            per-request CSP nonce (Next 16's middleware); next.config.ts holds the static security headers
instrumentation.ts  validates the environment once at server start
```

## Dependency rule

- `app → lib/{collector, queries, repo}`.
- `lib/collector → lib/{compute, sources, repo, logger, notify}` **through the `Deps` object passed in**.
- `lib/compute` and `lib/budget` import nothing from the project.
- `lib/logger` imports only `lib/repo` and `lib/redact`.
- Nothing in `lib/` imports from `app/`.

No DI container, no base classes, no event bus, no generic repository. `Deps` is the one injection boundary, because it is the only place tests swap implementations.

## Deps

The shape Session 2–4 implement. Names follow docs/GLOSSARY.md; the source types were settled in Session 2 (lib/sources/types.ts); Repo is Session 3.

```ts
// lib/sources/types.ts (Session 2) — the source of truth; this is a copy for orientation.
type UnionId = number;
type Uid = number;
type Phase = "before" | "after";

interface MemberInput {
  uid: Uid;
  name: string;
  power: number | null; // null kept, summed as 0 (D15)
  kills: number | null;
  lv: number | null;
}

/** The one output type of both adapters (plan Phase 2). */
interface AllianceSnapshotInput {
  unionId: UnionId;
  tag: string;
  name: string;
  memberCount: number;
  totalPower: number;
  totalKills: number; // sumKills(members)
  members: MemberInput[];
  serverRank: number | null;
  level: number | null;
  sourceUpdatedAt: Date | null;
  cached: boolean | null; // null for internal
  quota: Quota | null; // from that /v1 response; null for internal
  raw: unknown;
}

interface Quota {
  remaining: number;
  limit: number;
  used: number;
}

interface RanksBoard {
  pulledAt: Date; // older of the two boards
  power: Map<UnionId, number>;
  kills: Map<UnionId, number>;
}

/** Called before every /v1 attempt, retries included; the collector counts calls here (Session 3). */
type OnAttempt = (attempt: number) => void;

interface V1Source {
  fetchAlliance(id: UnionId, onAttempt?: OnAttempt): Promise<AllianceSnapshotInput>;
  fetchQuota(onAttempt?: OnAttempt): Promise<Quota>;
}

interface InternalSource {
  fetchRanks(server: number): Promise<RanksBoard>;
  /** live: true rosters only; throws NotLiveError on the stub shape. */
  fetchAlliance(id: UnionId): Promise<AllianceSnapshotInput>;
}

// Errors (instanceof): QuotaExhaustedError (429), NotFoundError (404), NotLiveError (stub),
// SchemaError { code: "v1.schema" | "internal.schema", paths }, UpstreamError { status }.

// lib/repo/index.ts (Session 3); createRepo(db) over Drizzle, createMemoryRepo() for tests and snapshot:dry.
interface Repo {
  getEvent(eventId: number): Promise<EventRow | null>;
  setEventAllianceIds(eventId: number, ids: number[]): Promise<void>;
  findSnapshot(eventId: number, phase: Phase): Promise<SnapshotRow | null>;
  startSnapshot(
    eventId: number,
    phase: Phase,
    startedAt: Date,
    expected: SnapshotRow | null,
  ): Promise<number | null>; // compare-and-set claim
  clearAllianceRows(snapshotId: number): Promise<void>; // force only
  listAllianceRows(snapshotId: number): Promise<AllianceRowStatus[]>;
  insertAllianceRow(snapshotId: number, row: AllianceRow, members: MemberRow[]): Promise<void>; // one transaction
  finishSnapshot(snapshotId: number, result: SnapshotResult): Promise<void>; // calls_used accumulates
}

interface Logger {
  info(code: string, data?: Record<string, unknown>): Promise<void>;
  warn(code: string, data?: Record<string, unknown>): Promise<void>;
  error(code: string, data?: Record<string, unknown>): Promise<void>;
}

// Session 4. Not in Deps yet: runSnapshot returns a RunSummary (status, stale and failed alliances)
// for the caller to pass on.
interface Notify {
  snapshotFinished(summary: {
    snapshotId: number;
    phase: Phase;
    status: "complete" | "partial" | "failed";
  }): Promise<void>;
}

interface Deps {
  v1: V1Source;
  internal: InternalSource;
  repo: Repo;
  logger: Logger;
  now: () => Date;
}
```
