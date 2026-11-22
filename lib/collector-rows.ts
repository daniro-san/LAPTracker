// Domain: the rows the collector stores per alliance (data from a source, or an error placeholder).
import { isFresh } from "./compute";
import { trimRaw } from "./raw-json";
import type { AllianceRow, AllianceRowStatus } from "./repo";
import type { AllianceSnapshotInput, RanksBoard } from "./sources/types";

export const FRESH_MAX_AGE_MS = 20 * 60_000;
/** 20 alliances × 3 retries × 2 phases (Logging guarantees). */
export const MAX_UPSTREAM_CALLS = 120;

export function dataRow(
  board: RanksBoard | null,
  now: Date,
  a: AllianceSnapshotInput,
  source: AllianceRow["source"],
): AllianceRow {
  return {
    unionId: a.unionId,
    tag: a.tag,
    name: a.name,
    memberCount: a.memberCount,
    capacity: a.capacity ?? null,
    totalPower: a.totalPower,
    // INVARIANT total-kills-is-roster-sum: the board number is stored beside it, never instead.
    totalKills: a.totalKills,
    serverRank: a.serverRank,
    level: a.level,
    badgeId: a.badgeId ?? null,
    powerBoard: board?.power.get(a.unionId) ?? null,
    killsBoard: board?.kills.get(a.unionId) ?? null,
    source,
    sourceUpdatedAt: a.sourceUpdatedAt,
    cached: a.cached,
    // INVARIANT freshness.20-min: judged against `now` (deps.now) at the time the row is stored.
    isFresh: isFresh(now, a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
    error: null,
    raw: trimRaw(a.raw),
  };
}

/** `label`: the alliance's newest tag and name (D133: from the board), so a failed row still names it. */
export function errorRow(
  unionId: number,
  error: string,
  label?: { tag: string | null; name: string | null },
): AllianceRow {
  return {
    unionId,
    tag: label?.tag ?? null,
    name: label?.name ?? null,
    memberCount: null,
    totalPower: null,
    totalKills: null,
    serverRank: null,
    level: null,
    powerBoard: null,
    killsBoard: null,
    source: "v1",
    sourceUpdatedAt: null,
    cached: null,
    isFresh: false,
    error,
    raw: null,
  };
}

/** Rows with an error, then the alliances the run never reached (429, quota, cap, deadline), with `tags`. */
export function failedList(
  rows: AllianceRowStatus[],
  ids: number[],
  error: string | null,
  tags: ReadonlyMap<number, string | null>,
) {
  return [
    ...rows.flatMap((r) =>
      r.error === null ? [] : [{ unionId: r.unionId, tag: r.tag, error: r.error }],
    ),
    // The admin needs the unreached alliances named to re-run them.
    ...ids
      .filter((id) => !rows.some((r) => r.unionId === id))
      .map((unionId) => ({
        unionId,
        tag: tags.get(unionId) ?? null,
        error: `not fetched: ${error}`,
      })),
  ];
}
