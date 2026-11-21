// The one output type of both adapters (plan Phase 2) and the errors callers match with instanceof.

export type UnionId = number;
export type Uid = number;

export interface MemberInput {
  uid: Uid;
  name: string;
  /** null when the upstream sends null; kept on the row, summed as 0 (docs/decisions/D15). */
  power: number | null;
  kills: number | null;
  lv: number | null;
  /** The player's photo URL as sent upstream; null when empty. Served only via /img/avatar/[uid] (D22). */
  avatarUrl?: string | null;
  /** The avatar frame's id, from `frame_url` (`frame_5001.png` → 5001); null when not sent. Served only
   * via /img/frame/[id] (D65). */
  frameId?: number | null;
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
  /** The ranked members: the body's members less those with an empty rank (issue 481). */
  members: MemberInput[];
  /** How many members the body listed, the unranked ones included; absent when built by hand. */
  listed?: number;
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

/** One hero of a squad as /v1/players sends it (D117); `star` is the raw value, 0–50: star level floor(star / 5). */
export interface HeroInput {
  id: number;
  lv: number | null;
  star: number | null;
  /** Rarity: 3 SR, 4 SSR, 5 UR (owner, 2026-11-18); the same for every copy of a hero. */
  q: number | null;
  awaken: number | null;
  /** The hero's Hall of Honor level (D132). */
  honor: number | null;
}

/** One troop kind of a squad (D132): type id, tier and count. */
export interface TroopInput {
  id: number;
  tier: number | null;
  n: number | null;
}

/** One squad the tracker has seen (D117). Only seen squads come back, so a list is partial. */
export interface SquadInput {
  squad: number;
  power: number;
  soldiers: number | null;
  soldierLoad: number | null;
  /** When the tracker saw it; null when not sent. */
  seenAt: Date | null;
  heroes: HeroInput[];
  troops: TroopInput[];
}

/**
 * The fields of a /v1/players body kept as columns (D132). Never x, y, online, last_online_at or
 * avatar_url. `unionId` is the alliance the body names.
 */
export interface PlayerFacts {
  shielding: number | null;
  shieldType: number | null;
  mapUpdatedAt: Date | null;
  lastSeenAt: Date | null;
  language: string | null;
  power: number | null;
  kills: number | null;
  unionId: UnionId | null;
  sid: number | null;
  homeSid: number | null;
  vip: number | null;
}

/** One row of the body's `history[]` (D132), keyed by `t` (its `observed_at`); never x or y. */
export interface HistoryInput {
  t: Date;
  power: number | null;
  kills: number | null;
  level: number | null;
  vip: number | null;
  unionId: UnionId | null;
  unionAbbr: string | null;
  sid: number | null;
  changeFlags: string | null;
  nick: string | null;
}

/**
 * One GET /v1/players/{uid} answer (D117, D132): the squads, the facts and history kept, and `raw`, the
 * body less `alliance_members`. `roster`: the uids of the body's alliance roster and when the tracker
 * updated that alliance, used only to queue members who joined during the day (D132); never stored.
 */
export interface PlayerSquadsInput {
  uid: Uid;
  squads: SquadInput[];
  quota: Quota | null;
  facts: PlayerFacts;
  history: HistoryInput[];
  raw: Record<string, unknown>;
  roster: { unionId: UnionId; updatedAt: Date; uids: Uid[] } | null;
}

/** An alliance's label as the ranks board shows it (D133); empty values are null. */
export interface BoardLabel {
  tag: string | null;
  name: string | null;
  /** 0 on the board means none: null here. */
  badgeId: number | null;
}

export interface RanksBoard {
  /** The older of the two boards' pulled_at. */
  pulledAt: Date;
  power: Map<UnionId, number>;
  kills: Map<UnionId, number>;
  /** Every alliance on either board (D133). */
  labels: Map<UnionId, BoardLabel>;
}

/**
 * Called before every /v1 request attempt, retries included (attempt 0 is the first). Each attempt
 * spends quota, so the collector counts calls here. If it throws, that attempt is not sent.
 * `status` is the response that caused this retry; null on attempt 0.
 */
export type OnAttempt = (attempt: number, status?: number | null) => void;

/** Per-call limits that replace the adapter's defaults (a sample, D69). */
export interface CallOptions {
  /** Replaces TIMEOUT_MS for each attempt of the call. */
  timeoutMs?: number | undefined;
  /** Replaces MAX_RETRIES: 0 sends the call once. */
  maxRetries?: number | undefined;
  /** A workspace's own tracker key (D124), in place of LAP_API_KEY; decrypted by the caller at call time. */
  apiKey?: string | undefined;
  /** An alliance read: false asks for the tracker's cached copy, without `?fresh=1` (D133). Default true (D64). */
  fresh?: boolean | undefined;
}

export interface V1Source {
  /** `signal` cuts the call when it aborts (the run deadline), on top of TIMEOUT_MS. */
  fetchAlliance(
    id: UnionId,
    onAttempt?: OnAttempt,
    signal?: AbortSignal,
    options?: CallOptions,
  ): Promise<AllianceSnapshotInput>;
  fetchQuota(onAttempt?: OnAttempt, signal?: AbortSignal, options?: CallOptions): Promise<Quota>;
  /** GET /v1/players/{uid}, the tracker's cached copy (no `fresh`): squads (D117) and the read (D132). */
  fetchPlayer(
    uid: Uid,
    onAttempt?: OnAttempt,
    signal?: AbortSignal,
    options?: CallOptions,
  ): Promise<PlayerSquadsInput>;
}

export interface InternalSource {
  fetchRanks(server: number): Promise<RanksBoard>;
  /** live: true rosters only; throws NotLiveError on the stub shape. */
  fetchAlliance(id: UnionId): Promise<AllianceSnapshotInput>;
}

export type SchemaCode = "v1.schema" | "internal.schema";

/**
 * What the upstream answered, for /admin only (D61): the request path, and for an HTTP error its status,
 * a few headers and the start of its body; for a request that got no answer, the timeout or the cause.
 * Redacted (no key, no secret) before it is built; never shown on a public page or in an API response.
 */
export interface UpstreamDetail {
  path: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  cause?: string;
}

/** 429: the daily quota is spent. The run aborts; never retried. */
export class QuotaExhaustedError extends Error {
  override name = "QuotaExhaustedError";
  constructor(
    message: string,
    readonly detail?: UpstreamDetail,
  ) {
    super(message);
  }
}

export class NotFoundError extends Error {
  override name = "NotFoundError";
  constructor(
    message: string,
    readonly detail?: UpstreamDetail,
  ) {
    super(message);
  }
}

/** The internal API returned the live: false stub, which is never used (plan §3.5). */
export class NotLiveError extends Error {
  override name = "NotLiveError";
}

/**
 * A 200 answer for alliance X that holds another alliance's roster (D69 amendment, 2026-11-21): another id
 * (`id`), or a tag X is not known by with members X does not have (`tag`). Counted as a failed read of X.
 */
export class IdentityError extends Error {
  override name = "IdentityError";
  constructor(readonly reason: "id" | "tag") {
    super(`wrong alliance (${reason})`);
  }
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
  constructor(
    readonly status: number,
    readonly detail?: UpstreamDetail,
  ) {
    super(`upstream status ${status}`);
  }
}

/**
 * The request got no HTTP answer: the per-call timeout, or a network failure (DNS, TLS, reset). It keeps
 * the cause's name ("TimeoutError", "TypeError"), so the run's one-line error and the upstream banner's
 * rule (D27) read the same as before; `detail` adds the path and the cause for /admin.
 */
export class RequestError extends Error {
  override name: string;
  constructor(
    cause: unknown,
    readonly detail: UpstreamDetail,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = cause instanceof Error ? cause.name : "Error";
  }
}
