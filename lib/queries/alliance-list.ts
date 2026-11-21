// Every alliance on the server (D133, issue 459): the newest ranks board's numbers for each, the day's tracked
// set first, the rest a page at a time; and for one alliance its board line and whether "Get today's details"
// may be pressed. Board numbers (might, kills, places) and labels only: no roster field.
import { desc, eq, max } from "drizzle-orm";

import { LOOKUPS_PER_DAY } from "../../config/alliances";
import type { Db } from "../db";
import { lookupOf, lookupsOn, shownStatus, type LookupStatus } from "../repo/alliance-lookups";
import {
  allianceLabels,
  knownAlliances,
  recentTrackedSets,
  trackedAllianceIds,
  trackedSetOf,
  type AllianceLabel,
} from "../repo/alliances";
import { inEventWindow, serverDay, type ScheduleConfig } from "../schedule";
import { events } from "../schema";
import { allianceBoard } from "../schema-alliances";
import { dailyIds } from "../workspace-keys";

export { knownAlliances, type AllianceLabel };

/** The rest of the list, after the tracked set, this many a page. */
export const MORE_PER_PAGE = 25;

export interface BoardAlliance extends AllianceLabel {
  unionId: number;
  power: number | null;
  powerRank: number | null;
  kills: number | null;
  killsRank: number | null;
}

export interface AllianceList {
  /** The board's server day and when the site pulled it; null before the first board was read. */
  day: string | null;
  pulledAt: Date | null;
  /** Every alliance on the board. */
  total: number;
  /** The day's tracked set, by board might. */
  tracked: BoardAlliance[];
  /** This page of the others, by board might. */
  more: BoardAlliance[];
  page: number;
  pages: number;
}

const boardColumns = {
  unionId: allianceBoard.unionId,
  tag: allianceBoard.tag,
  name: allianceBoard.name,
  badgeId: allianceBoard.badgeId,
  power: allianceBoard.power,
  powerRank: allianceBoard.powerRank,
  kills: allianceBoard.kills,
  killsRank: allianceBoard.killsRank,
  pulledAt: allianceBoard.pulledAt,
};

/** By board might, then by kills, then by id: an alliance on the kills board only goes last. */
const byMight = (a: BoardAlliance, b: BoardAlliance) =>
  (a.powerRank ?? Infinity) - (b.powerRank ?? Infinity) ||
  (a.killsRank ?? Infinity) - (b.killsRank ?? Infinity) ||
  a.unionId - b.unionId;

/** The newest board; `page` is 1-based and clamped to the pages there are. */
export async function allianceList(db: Db, page: number): Promise<AllianceList> {
  const [newest] = await db.select({ day: max(allianceBoard.day) }).from(allianceBoard);
  const day = newest?.day ?? null;
  if (!day) return { day, pulledAt: null, total: 0, tracked: [], more: [], page: 1, pages: 1 };
  const [rows, set] = await Promise.all([
    db.select(boardColumns).from(allianceBoard).where(eq(allianceBoard.day, day)),
    trackedSetOf(db, day),
  ]);
  const ids = set?.allianceIds ?? (await trackedAllianceIds(db));
  const all = rows.map(({ pulledAt: _, ...r }) => r).sort(byMight);
  const rest = all.filter((a) => !ids.includes(a.unionId));
  const pages = Math.max(1, Math.ceil(rest.length / MORE_PER_PAGE));
  const at = Math.min(Math.max(1, page), pages);
  return {
    day,
    pulledAt: rows[0]?.pulledAt ?? null,
    total: all.length,
    tracked: all.filter((a) => ids.includes(a.unionId)),
    more: rest.slice((at - 1) * MORE_PER_PAGE, at * MORE_PER_PAGE),
    page: at,
    pages,
  };
}

/** The alliances an event read (its Before's copy): a list row links to the alliance's page in it. */
export async function eventAllianceIds(db: Db, eventId: number): Promise<number[]> {
  const [row] = await db
    .select({ ids: events.allianceIds })
    .from(events)
    .where(eq(events.id, eventId));
  return row?.ids ?? [];
}

/** One alliance's row of its newest board, with that board's day; null when no board listed it. */
export async function allianceOnBoard(
  db: Db,
  unionId: number,
): Promise<(BoardAlliance & { day: string; pulledAt: Date }) | null> {
  const [row] = await db
    .select({ ...boardColumns, day: allianceBoard.day })
    .from(allianceBoard)
    .where(eq(allianceBoard.unionId, unionId))
    .orderBy(desc(allianceBoard.day))
    .limit(1);
  return row ?? null;
}

/**
 * "Get today's details" on an alliance's page (D133). `daily`: the daily read covers it, so no button.
 * Otherwise `lookup` is today's claim (its outcome and time), else why a press would be refused now
 * (`usedUp`: the day's LOOKUPS_PER_DAY are claimed; `eventWindow`: the scheduled event is running).
 */
export interface DetailsState {
  daily: boolean;
  lookup: { status: LookupStatus; at: Date } | null;
  usedUp: boolean;
  eventWindow: boolean;
}

export async function detailsState(
  db: Db,
  unionId: number,
  now: Date,
  cfg: ScheduleConfig & { WORKSPACE_KEYS_SECRET?: string | undefined },
): Promise<DetailsState> {
  const day = serverDay(now, cfg);
  const [daily, lookup, today] = await Promise.all([
    dailyIds(db, day, cfg.WORKSPACE_KEYS_SECRET, now),
    lookupOf(db, unionId, day),
    lookupsOn(db, day),
  ]);
  return {
    daily: daily.includes(unionId),
    lookup: lookup && {
      status: shownStatus(lookup, now),
      at: lookup.finishedAt ?? lookup.claimedAt,
    },
    usedUp: today.length >= LOOKUPS_PER_DAY,
    eventWindow: inEventWindow(now, cfg),
  };
}

/**
 * /admin's Tracked alliances card (D133): the sets of the newest `n` days, newest first, each with the
 * alliances that entered and left against the day before; today's lookups; and a label for every id named.
 */
export async function adminTracked(db: Db, n: number, now: Date, cfg: ScheduleConfig) {
  const [sets, lookups] = await Promise.all([
    recentTrackedSets(db, n + 1),
    lookupsOn(db, serverDay(now, cfg)),
  ]);
  const days = sets.slice(0, n).map((s, i) => {
    const before = sets[i + 1]?.allianceIds ?? null;
    return {
      ...s,
      entered: before ? s.allianceIds.filter((id) => !before.includes(id)) : [],
      left: before ? before.filter((id) => !s.allianceIds.includes(id)) : [],
    };
  });
  const ids = [
    ...new Set([...sets.flatMap((s) => s.allianceIds), ...lookups.map((l) => l.unionId)]),
  ];
  // A claim a killed function left running reads as failed (LOOKUP_STALE_AFTER_MS).
  const shown = lookups.map((l) => ({ ...l, status: shownStatus(l, now) }));
  return { days, lookups: shown, labels: await allianceLabels(db, ids) };
}
