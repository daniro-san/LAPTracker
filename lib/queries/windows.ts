// The members of an event's Befores and Afters between its windows (D160), for the member-level readers
// that sum an event's windows' changes (movers, turnout). Fields: uid, power and kills only.
import { eq, inArray } from "drizzle-orm";

import { windowedStart, type Measured } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots } from "../schema";

/** One slot between windows: each member's figures by uid; a stale or failed alliance row is not fresh. */
export type BetweenMembers = Map<number, Measured>;

/** The members of each id from `betweenWindowIds` (in its order); an empty map for a missing row. */
export async function betweenMembers(
  db: Db,
  ids: readonly (number | null)[],
): Promise<BetweenMembers[]> {
  const present = ids.filter((id) => id !== null);
  const rows = present.length
    ? await db
        .select({
          snapshotId: allianceSnapshots.snapshotId,
          isFresh: allianceSnapshots.isFresh,
          error: allianceSnapshots.error,
          uid: memberSnapshots.uid,
          power: memberSnapshots.power,
          kills: memberSnapshots.kills,
        })
        .from(memberSnapshots)
        .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
        .where(inArray(allianceSnapshots.snapshotId, present))
    : [];
  return ids.map(
    (id) =>
      new Map(
        rows
          .filter((r) => r.snapshotId === id)
          .map((r) => [
            r.uid,
            { isFresh: r.isFresh && r.error === null, totalPower: r.power, totalKills: r.kills },
          ]),
      ),
  );
}

/**
 * Rows between an event's windows in the order `windowedStart` takes them (window 1's After, window 2's
 * Before, …, up to `endWindow`, the window of the event's End), with a missing row left undefined.
 */
export function betweenSlots<T>(
  rows: readonly { window: number; phase: string; value: T }[],
  endWindow: number,
): (T | undefined)[] {
  return Array.from({ length: Math.max(0, endWindow - 1) }, (_, i) => [
    rows.find((r) => r.window === i + 1 && r.phase === "after")?.value,
    rows.find((r) => r.window === i + 2 && r.phase === "before")?.value,
  ]).flat();
}

/** A member's Start as the sum of the windows' changes sees it (`windowedStart`). */
export const memberStart = <M extends Measured>(
  start: M,
  uid: number,
  between: readonly BetweenMembers[],
): M =>
  windowedStart(
    start,
    between.map((m) => m.get(uid)),
  );
