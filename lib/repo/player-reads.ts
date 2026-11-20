// player_reads and player_history (D132, issue 490): every /v1/players answer of the squads read, kept for
// the alliance whose workspace read it. Writes and the 90-day clean-up only: no query here returns
// raw_json, and nothing reads x, y, online, last_online_at or avatar_url out of it (D71, D22).
import { and, isNotNull, lt } from "drizzle-orm";

import type { Db } from "../db";
import { playerHistory, playerReads } from "../schema-squads";
import type { PlayerSquadsInput } from "../sources/types";

/** How long a read's raw body is kept; its columns and the history rows stay. */
export const PLAYER_RAW_DAYS = 90;

/**
 * One answer: a `player_reads` row (the body less `alliance_members`, and the facts as columns) and each
 * `history[]` row the alliance does not have yet for that member (INVARIANT players.history-once).
 * Returns how many history rows were new.
 */
export async function storePlayerRead(
  db: Db,
  unionId: number,
  read: Pick<PlayerSquadsInput, "uid" | "facts" | "history" | "raw">,
  readAt: Date,
): Promise<number> {
  const { uid, facts: f } = read;
  await db.insert(playerReads).values({
    unionId,
    uid,
    readAt,
    rawJson: read.raw,
    shielding: f.shielding,
    shieldType: f.shieldType,
    mapUpdatedAt: f.mapUpdatedAt,
    lastSeenAt: f.lastSeenAt,
    language: f.language,
    power: f.power === null ? null : Math.round(f.power),
    kills: f.kills === null ? null : Math.round(f.kills),
    playerUnionId: f.unionId,
    sid: f.sid,
    homeSid: f.homeSid,
    vip: f.vip,
  });
  if (read.history.length === 0) return 0;
  const added = await db
    .insert(playerHistory)
    .values(
      read.history.map((h) => ({
        unionId,
        uid,
        t: h.t,
        power: h.power === null ? null : Math.round(h.power),
        kills: h.kills === null ? null : Math.round(h.kills),
        level: h.level,
        vip: h.vip,
        playerUnionId: h.unionId,
        unionAbbr: h.unionAbbr,
        sid: h.sid,
        changeFlags: h.changeFlags,
        nick: h.nick,
      })),
    )
    .onConflictDoNothing()
    .returning({ t: playerHistory.t });
  return added.length;
}

/** The daily clean-up: raw bodies older than PLAYER_RAW_DAYS are cleared; returns how many. */
export async function clearOldPlayerRaw(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - PLAYER_RAW_DAYS * 86_400_000);
  const cleared = await db
    .update(playerReads)
    .set({ rawJson: null })
    .where(and(lt(playerReads.readAt, before), isNotNull(playerReads.rawJson)))
    .returning({ id: playerReads.id });
  return cleared.length;
}
