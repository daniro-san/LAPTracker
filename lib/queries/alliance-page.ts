// The public alliance page, /alliances/[unionId] (issue 822): the head's facts, the members with their public
// fields and the growth of might and members, from the alliance's usable daily rosters (D60, D72). Per member
// it serves rank, name, might, weekly activity (`active`), Alliance Help coins (`daily_honor`) and tech donated
// (`daily_tech`), public since the owner's decision of 2026-11-28 (D76 amendment). Only those keys leave
// raw_json, picked out in SQL; never a key of BLOCKED_ROSTER_KEYS. `playerInAlliance` gives the player page
// (issue 824) one member's rank and weekly activity from the same rosters.
import { and, arrayContains, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { addDays } from "../calendar-time";
import type { Db } from "../db";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";
import { roleOf, type Role } from "./leadership";

/** The growth card reads this many days back from the newest roster: its longest range. */
export const GROWTH_DAYS = 90;

const LEADER = 105;

export interface AlliancePageMember {
  uid: number;
  name: string;
  /** 1 to 5 (R1–R5); null when the read has no rank. */
  rank: number | null;
  /** The R5, or an R4 with a title. */
  role: Role | null;
  power: number | null;
  /** Quest points since Monday's reset (D127); null: not sent. */
  active: number | null;
  /** Alliance Help coins on the read's day (at most 1,000); null: not sent. */
  dailyHonor: number | null;
  /** Tech donated on the read's day; null: not sent. */
  dailyTech: number | null;
}

export interface GrowthPoint {
  day: string;
  might: number;
  members: number;
}

export interface AlliancePage {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** The newest usable roster's server day and when the upstream read it. */
  day: string;
  at: Date | null;
  server: number | null;
  might: number | null;
  members: number | null;
  capacity: number | null;
  leader: { uid: number; name: string; power: number | null } | null;
  /** By rank (R5 first), then by might; never by activity. */
  roster: AlliancePageMember[];
  /** One point per usable roster of the last GROWTH_DAYS days, oldest first. */
  growth: GrowthPoint[];
}

/** The member keys read from raw_json, and nothing else. */
const KEYS = [
  "uid",
  "nick_name",
  "power",
  "rank_code",
  "rank_label",
  "active",
  "daily_honor",
  "daily_tech",
] as const;
type RawMember = Partial<Record<(typeof KEYS)[number], unknown>>;

const membersOf = sql<RawMember[]>`coalesce((select jsonb_agg(jsonb_build_object(${sql.raw(
  KEYS.map((k) => `'${k}', m->'${k}'`).join(", "),
)})) from jsonb_array_elements(${dailyRosters.rawJson}->'members') m), '[]'::jsonb)`;

const raw = (key: string) => sql<unknown>`${dailyRosters.rawJson}->${key}`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Issue 481: the game once sent 101 of 100; the page never shows more members than the capacity. */
const capped = (members: number | null, capacity: number | null) =>
  members !== null && capacity !== null ? Math.min(members, capacity) : members;

const usable = (unionId: number) => and(eq(dailyRosters.unionId, unionId), dailyFit);

function memberOf(m: RawMember): AlliancePageMember | null {
  const uid = num(m.uid);
  if (uid === null || !Number.isSafeInteger(uid)) return null;
  const code = num(m.rank_code);
  const label = typeof m.rank_label === "string" ? m.rank_label : null;
  return {
    uid,
    name: typeof m.nick_name === "string" ? m.nick_name : "",
    rank: code !== null && code >= 101 && code <= 105 ? code - 100 : null,
    role: code === null ? null : roleOf(code, label),
    power: num(m.power),
    active: num(m.active),
    dailyHonor: num(m.daily_honor),
    dailyTech: num(m.daily_tech),
  };
}

/** R5 first, then R4…R1, a member with no rank last; within a rank by might, then by name. */
export const byRankThenMight = (a: AlliancePageMember, b: AlliancePageMember) =>
  (b.rank ?? 0) - (a.rank ?? 0) ||
  (b.power ?? -1) - (a.power ?? -1) ||
  a.name.localeCompare(b.name);

/** The page's read model, or null when the alliance has no usable roster that kept its response. */
export async function alliancePage(db: Db, unionId: number): Promise<AlliancePage | null> {
  const [row] = await db
    .select({
      day: dailyRosters.readDay,
      at: dailyRosters.sourceUpdatedAt,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
      might: dailyRosters.totalPower,
      members: dailyRosters.memberCount,
      uids: dailyRosters.memberUids,
      server: raw("sid"),
      capacity: raw("capacity"),
      roster: membersOf,
    })
    .from(dailyRosters)
    .where(and(usable(unionId), isNotNull(dailyRosters.rawJson)))
    .orderBy(desc(dailyRosters.readDay))
    .limit(1);
  if (!row) return null;
  const growth = await db
    .select({
      day: dailyRosters.readDay,
      might: dailyRosters.totalPower,
      members: dailyRosters.memberCount,
      capacity: raw("capacity"),
    })
    .from(dailyRosters)
    .where(and(usable(unionId), gte(dailyRosters.readDay, addDays(row.day, -GROWTH_DAYS))))
    .orderBy(dailyRosters.readDay);
  // Only the row's own members: raw_json also keeps those the read left out for an empty rank (issue 481).
  const uids = new Set(row.uids);
  const roster = row.roster
    .map(memberOf)
    .filter((m): m is AlliancePageMember => m !== null && uids.has(m.uid))
    .sort(byRankThenMight);
  const leader = roster.find((m) => m.rank === LEADER - 100);
  const capacity = num(row.capacity);
  return {
    unionId,
    tag: row.tag,
    name: row.name,
    badgeId: row.badgeId,
    day: row.day,
    at: row.at,
    server: num(row.server),
    might: row.might,
    members: capped(row.members, capacity),
    capacity,
    leader: leader ? { uid: leader.uid, name: leader.name, power: leader.power } : null,
    roster,
    growth: growth.flatMap((g) =>
      g.might === null || g.members === null
        ? []
        : [
            {
              day: g.day,
              might: g.might,
              members: Math.min(g.members, num(g.capacity) ?? Infinity),
            },
          ],
    ),
  };
}

export interface PlayerInAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** The roster's server day and when the upstream read it. */
  day: string;
  at: Date | null;
  server: number | null;
  /** 1 to 5 (R1–R5); null when the read has no rank. */
  rank: number | null;
  role: Role | null;
  /** Quest points since Monday's reset (D127); null: not sent. */
  active: number | null;
}

/** The player's newest usable daily roster that kept its response: the alliance, its server, and the player's
 * rank and quest points there. Null when no such roster holds the player. */
export async function playerInAlliance(db: Db, uid: number): Promise<PlayerInAlliance | null> {
  const [row] = await db
    .select({
      unionId: dailyRosters.unionId,
      day: dailyRosters.readDay,
      at: dailyRosters.sourceUpdatedAt,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
      server: raw("sid"),
      member: sql<RawMember | null>`(select jsonb_build_object('rank_code', m->'rank_code', 'rank_label', m->'rank_label', 'active', m->'active') from jsonb_array_elements(${dailyRosters.rawJson}->'members') m where m->'uid' = to_jsonb(${uid}::bigint) limit 1)`,
    })
    .from(dailyRosters)
    .where(
      and(dailyFit, isNotNull(dailyRosters.rawJson), arrayContains(dailyRosters.memberUids, [uid])),
    )
    .orderBy(desc(dailyRosters.readDay), desc(dailyRosters.sourceUpdatedAt))
    .limit(1);
  if (!row) return null;
  const { member, server, ...rest } = row;
  const m = member && memberOf({ ...member, uid });
  return {
    ...rest,
    server: num(server),
    rank: m?.rank ?? null,
    role: m?.role ?? null,
    active: m?.active ?? null,
  };
}
