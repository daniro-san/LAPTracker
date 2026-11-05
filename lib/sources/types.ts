// The one output type of both adapters (plan Phase 2) and the errors callers match with instanceof.

export type UnionId = number;
export type Uid = number;

export interface MemberInput {
  uid: Uid;
  name: string;
  /** null when the upstream sends null; kept on the row, summed as 0 (DECISIONS D15). */
  power: number | null;
  kills: number | null;
  lv: number | null;
  /** The player's photo URL as sent upstream; null when empty. Served only via /img/avatar/[uid] (D22). */
  avatarUrl?: string | null;
  /** /v1 `rank_code` (105 = R5, 104 = R4, ...) and `rank_label` ("R4 · Diplomat"); null when not sent. */
  rankCode?: number | null;
  rankLabel?: string | null;
}

export interface Quota {
  remaining: number;
  limit: number;
  used: number;
}

export interface AllianceSnapshotInput {
  unionId: UnionId;
  tag: string;
  name: string;
  memberCount: number;
  /** The most members the alliance can hold; null when the source does not say. */
  capacity?: number | null;
  totalPower: number;
  /** sum(members.kills), nulls as 0. INVARIANT total-kills-is-roster-sum */
  totalKills: number;
  members: MemberInput[];
  serverRank: number | null;
  level: number | null;
  /** One of the preset emblems (101–110 seen); served only via /img/badge/[id] (D22). */
  badgeId?: number | null;
  sourceUpdatedAt: Date | null;
  /** null for the internal source, which has no cache flag. */
  cached: boolean | null;
  /** Quota as reported by this response; null for the internal source. */
  quota: Quota | null;
  raw: unknown;
}

export interface RanksBoard {
  /** The older of the two boards' pulled_at. */
  pulledAt: Date;
  power: Map<UnionId, number>;
  kills: Map<UnionId, number>;
}

/**
 * Called before every /v1 request attempt, retries included (attempt 0 is the first). Each attempt
 * spends quota, so the collector counts calls here. If it throws, that attempt is not sent.
 */
export type OnAttempt = (attempt: number) => void;

export interface V1Source {
  /** `signal` cuts the call when it aborts (the run deadline), on top of TIMEOUT_MS. */
  fetchAlliance(
    id: UnionId,
    onAttempt?: OnAttempt,
    signal?: AbortSignal,
  ): Promise<AllianceSnapshotInput>;
  fetchQuota(onAttempt?: OnAttempt, signal?: AbortSignal): Promise<Quota>;
}

export interface InternalSource {
  fetchRanks(server: number): Promise<RanksBoard>;
  /** live: true rosters only; throws NotLiveError on the stub shape. */
  fetchAlliance(id: UnionId): Promise<AllianceSnapshotInput>;
}

export type SchemaCode = "v1.schema" | "internal.schema";

/** 429: the daily quota is spent. The run aborts; never retried. */
export class QuotaExhaustedError extends Error {
  override name = "QuotaExhaustedError";
}

export class NotFoundError extends Error {
  override name = "NotFoundError";
}

/** The internal API returned the live: false stub, which is never used (plan §3.5). */
export class NotLiveError extends Error {
  override name = "NotLiveError";
}

/** The response no longer matches the fields we read. `code` is the run_logs code. Paths only, no values. */
export class SchemaError extends Error {
  override name = "SchemaError";
  constructor(
    readonly code: SchemaCode,
    readonly paths: string[],
  ) {
    super(`${code}: ${paths.join(", ")}`);
  }
}

/** Any other non-2xx, or 502/503/504 after the last retry. */
export class UpstreamError extends Error {
  override name = "UpstreamError";
  constructor(readonly status: number) {
    super(`upstream status ${status}`);
  }
}
