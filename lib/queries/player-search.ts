// The player search (plan Phase 5d, §3.8; split from players.ts for size): current or earlier names that
// contain the text, names that start with it first (issue 473). Served member fields as players.ts.
import { and, asc, desc, eq, ilike, max, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import type { Photo } from "./photo";
import { type Sighting, sightingsOf } from "./players";
import { publicEvent } from "./visibility";

export const SEARCH_LIMIT = 50;

export interface PlayerMatch extends Photo {
  uid: number;
  name: string;
  /** The older name that matched when the current one does not. */
  matchedName: string | null;
  unionId: number;
  tag: string | null;
  allianceName: string | null;
  /** The alliance's preset badge (101–110) in the latest sighting; served by /img/badge/[id] (D22). */
  badgeId: number | null;
  lastEventId: number;
  lastSeen: Date;
  /** Might and Sanctuary level in the latest sighting (issue 473). */
  power: number | null;
  lv: number | null;
}

/** `q` with `%`, `_` and `\` as literals, not wildcards. */
const literal = (q: string) => q.replace(/[\\%_]/g, "\\$&");
const likePattern = (q: string) => `%${literal(q)}%`;

/** Players whose current or any earlier name contains `q` (ILIKE, §3.8): an exact name first, then a name
 * that starts with `q` (issue 473), then most recently seen, then the shortest name; at most 50. */
export async function searchPlayers(db: Db, q: string): Promise<PlayerMatch[]> {
  const text = q.trim();
  if (text === "") return [];
  const lastSeen = max(events.eventAtUtc);
  const hits = await db
    .select({ uid: memberSnapshots.uid })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(ilike(memberSnapshots.name, likePattern(text)), publicEvent))
    .groupBy(memberSnapshots.uid)
    .orderBy(
      desc(sql`bool_or(${memberSnapshots.name} ilike ${literal(text)})`),
      desc(sql`bool_or(${memberSnapshots.name} ilike ${`${literal(text)}%`})`),
      desc(lastSeen),
      asc(sql`min(length(${memberSnapshots.name}))`),
      asc(memberSnapshots.uid),
    )
    .limit(SEARCH_LIMIT);
  const uids = hits.map((h) => h.uid);
  if (uids.length === 0) return [];
  const all = await sightingsOf(db, uids);
  return uids.map((uid) => {
    const own = all.filter((s) => s.uid === uid);
    const latest = own.at(-1) as Sighting;
    const matched = own.findLast((s) => s.name.toLowerCase().includes(text.toLowerCase()));
    return {
      uid,
      name: latest.name,
      matchedName: matched && matched.name !== latest.name ? matched.name : null,
      unionId: latest.unionId,
      tag: latest.tag,
      allianceName: latest.allianceName,
      badgeId: latest.badgeId,
      hasAvatar: latest.hasAvatar,
      frameId: latest.frameId,
      lastEventId: latest.eventId,
      lastSeen: latest.eventAtUtc,
      power: latest.power,
      lv: latest.lv,
    };
  });
}
