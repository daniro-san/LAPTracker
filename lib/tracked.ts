// The tracked set (D133, superseding D4's fixed list): each server day, before the daily read, the ranks board
// (internal API, no quota) is read and stored, and its TRACKED_COUNT alliances with the most might become that
// day's set. The daily read reads the set plus every workspace's alliance (D124's key rule); an event copies
// the newest set at its Before. A board that fails keeps the newest set; before any set, the newest event's list.
import { SERVER, TRACKED_COUNT } from "../config/alliances";
import { topByPower } from "./compute";
import { copy } from "./copy";
import type { Db } from "./db";
import { allianceLabel } from "./notify";
import {
  allianceLabels,
  claimTrackedSet,
  newestEventIds,
  recentTrackedSets,
  storeBoard,
  trackedSetOf,
  type TrackedSet,
} from "./repo/alliances";
import type { InternalSource } from "./sources/types";
import { describe } from "./upstream-errors";
import { fill } from "./words";
import { dailyTargets, type DailyTarget } from "./workspace-keys";

export interface TrackedDay extends TrackedSet {
  /** True for the one caller that wrote the day's set: it posts the change line. */
  created: boolean;
  /** Against the set before it (the newest event's list for the first set); empty unless `created`. */
  entered: number[];
  left: number[];
}

/**
 * The tracked set of `day`, read from the board and written by the first caller; later callers get the
 * stored one. Null only when there is nothing to track yet: no board, no earlier set and no event list.
 */
export async function trackedSetFor(
  deps: { internal: Pick<InternalSource, "fetchRanks">; now: () => Date },
  db: Db,
  day: string,
): Promise<TrackedDay | null> {
  const stored = await trackedSetOf(db, day);
  if (stored) return { ...stored, created: false, entered: [], left: [] };
  const [previous] = await recentTrackedSets(db, 1, day);
  let set: TrackedSet;
  try {
    const board = await deps.internal.fetchRanks(SERVER);
    await storeBoard(db, day, board);
    set = { day, allianceIds: topByPower(board.power, TRACKED_COUNT), source: "board" };
  } catch (e) {
    // The error's class only: no body or URL leaves here.
    console.warn("tracked.board_failed", { code: describe(e) });
    set = previous
      ? { day, allianceIds: previous.allianceIds, source: "previous" }
      : { day, allianceIds: await newestEventIds(db), source: "event" };
  }
  if (set.allianceIds.length === 0) return null;
  if (!(await claimTrackedSet(db, set, deps.now()))) {
    const won = await trackedSetOf(db, day);
    return won && { ...won, created: false, entered: [], left: [] };
  }
  const before = previous?.allianceIds ?? (await newestEventIds(db));
  return {
    ...set,
    created: true,
    entered: set.allianceIds.filter((id) => !before.includes(id)),
    left: before.filter((id) => !set.allianceIds.includes(id)),
  };
}

/** The day's set and the daily read's alliances with their keys: the set, then the workspaces outside it. */
export async function dayTargets(
  deps: {
    internal: Pick<InternalSource, "fetchRanks">;
    now: () => Date;
    secret: string | undefined;
  },
  db: Db,
  day: string,
): Promise<{ set: TrackedDay | null; targets: DailyTarget[] }> {
  const set = await trackedSetFor(deps, db, day);
  const targets = await dailyTargets(db, deps.secret, deps.now(), set?.allianceIds ?? []);
  return { set, targets };
}

/** The admin line when the day's set changed or the board failed; null when there is nothing to say. */
export async function trackedChangeMessage(
  db: Db,
  set: TrackedDay,
  origin: string,
): Promise<string | null> {
  const t = copy.discord.admin;
  if (!set.created) return null;
  if (set.source === "previous") return fill(t.trackedKept, { day: set.day });
  if (set.entered.length === 0 && set.left.length === 0) return null;
  const labels = await allianceLabels(db, [...set.entered, ...set.left]);
  const list = (ids: number[]) =>
    ids
      .map((unionId) => {
        const l = labels.get(unionId);
        return allianceLabel({ unionId, tag: l?.tag ?? null, name: l?.name ?? null });
      })
      .join(", ");
  return [
    fill(t.trackedChange, { day: set.day, n: TRACKED_COUNT, url: `${origin}/admin#tracked` }),
    ...(set.entered.length > 0 ? [fill(t.trackedIn, { list: list(set.entered) })] : []),
    ...(set.left.length > 0 ? [fill(t.trackedOut, { list: list(set.left) })] : []),
  ].join("\n");
}
