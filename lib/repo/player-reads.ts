// player_reads and player_history (D132, issue 490): every /v1/players answer of the squads read, kept for
// the alliance whose workspace read it. Writes, the 90-day clean-up and each member's newest game language
// (D140), and one player's own rows for the recruit check (issue 833): no query here returns raw_json, and
// nothing reads x, y, online, last_online_at or avatar_url out of it (D71, D22).
import { and, desc, eq, gte, ilike, inArray, isNotNull, lt } from "drizzle-orm";

import type { Db } from "../db";
import { playerHistory, playerReads } from "../schema-squads";
import type { PlayerSquadsInput } from "../sources/types";

/** How long a read's raw body is kept; its columns and the history rows stay. */
export const PLAYER_RAW_DAYS = 90;

/** The Postgres code of a failed query (drizzle keeps the driver's error as `cause`), else "unknown". */
function pgCode(e: unknown): string {
  for (let at: unknown = e; at instanceof Error; at = at.cause) {
    const code = (at as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return "unknown";
}

/**
 * A failed write leaves as its class and Postgres code only. A database error quotes the query's
 * parameters, here the raw body with x, y, online and avatar_url, and app_errors and console.error keep
 * a message (D71, as lib/private/http.ts `privately`; lib/ may not import lib/private). No `cause`.
 */
const codeOnly = <T>(work: () => Promise<T>): Promise<T> =>
  work().catch((e: unknown) => {
    const name = e instanceof Error ? e.name : "unknown";
    throw new Error(`player_reads.write_failed ${name} ${pgCode(e)}`);
  });

/**
 * One answer: a `player_reads` row (the body less `alliance_members`, and the facts as columns) and each
 * `history[]` row the alliance does not have yet for that member (INVARIANT players.history-once).
 * Returns how many history rows were new. A failure carries its class and Postgres code only.
 */
export const storePlayerRead = (
  db: Db,
  unionId: number,
  read: Pick<PlayerSquadsInput, "uid" | "facts" | "history" | "raw">,
  readAt: Date,
): Promise<number> => codeOnly(() => insertPlayerRead(db, unionId, read, readAt));

async function insertPlayerRead(
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

/**
 * Each of `uids`' game language and the time of the read it came from: the newest read of `unionId`'s own
 * workspace since `since` that has one (D132), by uid: one row per member (`DISTINCT ON`), on the members
 * asked for and a bounded window only, never the whole history (#521). Only that alliance's rows: a player
 * read by another workspace is not seen here (D71).
 */
export async function gameLanguageReads(
  db: Db,
  unionId: number,
  uids: readonly number[],
  since: Date,
): Promise<Map<number, { language: string; readAt: Date }>> {
  if (uids.length === 0) return new Map();
  const p = playerReads;
  const rows = await db
    .selectDistinctOn([p.uid], { uid: p.uid, language: p.language, readAt: p.readAt })
    .from(p)
    .where(
      and(
        eq(p.unionId, unionId),
        inArray(p.uid, [...uids]),
        gte(p.readAt, since),
        isNotNull(p.language),
      ),
    )
    .orderBy(p.uid, desc(p.readAt));
  return new Map(rows.map((r) => [r.uid, { language: r.language as string, readAt: r.readAt }]));
}

/** `gameLanguageReads` without the time: each member's newest game language code. */
export async function gameLanguages(
  db: Db,
  unionId: number,
  uids: readonly number[],
  since: Date,
): Promise<Map<number, string>> {
  const reads = await gameLanguageReads(db, unionId, uids, since);
  return new Map([...reads].map(([uid, r]) => [uid, r.language]));
}

/** One stored sighting of a player in an alliance's own reads: a history row, or a read's columns. */
export interface TrailPoint {
  at: Date;
  unionId: number | null;
  tag: string | null;
  name: string | null;
  power: number | null;
  kills: number | null;
}

/**
 * Every history row and read `unionId`'s workspace keeps of `uid` (issue 833): the alliance, tag, name, might
 * and kills at each time. Only that alliance's rows (D132); never raw_json or a private field.
 */
export async function playerTrail(db: Db, unionId: number, uid: number): Promise<TrailPoint[]> {
  const h = playerHistory;
  const p = playerReads;
  const [history, reads] = await Promise.all([
    db
      .select({
        at: h.t,
        unionId: h.playerUnionId,
        tag: h.unionAbbr,
        name: h.nick,
        power: h.power,
        kills: h.kills,
      })
      .from(h)
      .where(and(eq(h.unionId, unionId), eq(h.uid, uid))),
    db
      .select({ at: p.readAt, unionId: p.playerUnionId, power: p.power, kills: p.kills })
      .from(p)
      .where(and(eq(p.unionId, unionId), eq(p.uid, uid))),
  ]);
  return [...history, ...reads.map((r) => ({ ...r, tag: null, name: null }))];
}

/** The players whose name in `unionId`'s own history rows contains `q`, newest name each, at most `limit`. */
export async function trailNames(
  db: Db,
  unionId: number,
  q: string,
  limit: number,
): Promise<{ uid: number; name: string }[]> {
  const h = playerHistory;
  const rows = await db
    .selectDistinctOn([h.uid], { uid: h.uid, name: h.nick })
    .from(h)
    .where(
      and(
        eq(h.unionId, unionId),
        isNotNull(h.nick),
        ilike(h.nick, `%${q.replace(/[\\%_]/g, "\\$&")}%`),
      ),
    )
    .orderBy(h.uid, desc(h.t))
    .limit(limit);
  return rows.map((r) => ({ uid: r.uid, name: r.name as string }));
}
