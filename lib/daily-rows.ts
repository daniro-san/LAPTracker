// The daily read's rows (D60, D72), split from lib/daily-read.ts for size: a roster as a daily_rosters row,
// and the error row of an alliance the read could not get. "Get today's details" (D133) stores its roster
// with the same dataRow.
import { FRESH_MAX_AGE_MS } from "./collector-rows";
import { isFresh } from "./compute";
import { trimRaw } from "./raw-json";
import type { NewDailyRoster } from "./repo/daily-reads";
import type { AllianceSnapshotInput } from "./sources/types";
import { upstreamDetail } from "./upstream-errors";

/** A roster as a daily_rosters row; `maxAgeMs` is the freshness rule (a lookup's is wider, D133). */
export function dataRow(
  a: AllianceSnapshotInput,
  now: Date,
  maxAgeMs = FRESH_MAX_AGE_MS,
): NewDailyRoster {
  return {
    unionId: a.unionId,
    tag: a.tag,
    name: a.name,
    memberCount: a.memberCount,
    totalPower: a.totalPower,
    totalKills: a.totalKills,
    badgeId: a.badgeId ?? null,
    sourceUpdatedAt: a.sourceUpdatedAt,
    // INVARIANT freshness.20-min: the same rule as event snapshots (the daily read's default).
    isFresh: isFresh(now, a.sourceUpdatedAt, maxAgeMs),
    error: null,
    memberUids: a.members.map((m) => m.uid),
    memberNames: a.members.map((m) => m.name),
    // Arrays keep a null power or kills as null (D15); Drizzle types the elements as numbers.
    memberPower: a.members.map((m) => m.power) as number[],
    memberKills: a.members.map((m) => m.kills) as number[],
    // Every roster field, as event snapshots keep it (plan §6). A read model selects only the statement and
    // joining fields (D128); no roster field (D72).
    rawJson: trimRaw(a.raw),
  };
}

/** `e` is the failure itself: its upstream detail (D61) goes on the row for /admin/runs. */
export const errorRow = (
  unionId: number,
  tag: string | null,
  error: string,
  e: unknown,
): NewDailyRoster => ({
  unionId,
  tag,
  isFresh: false,
  error,
  errorDetail: upstreamDetail(e),
  memberUids: [],
  memberNames: [],
  memberPower: [],
  memberKills: [],
});
