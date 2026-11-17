// Daily roster reads for scripts/seed.ts (D60): one a day from Sunday to Friday after each of the first
// two seeded Saturdays, so the player page's Daily progress and the member history show daily readings.
// Might drifts part of the way from one event's End to the next event's Start; kills stay where the End
// reading left them (the real ones are unchanged day to day and move at events). Reseeding gives the same
// numbers.
import type { Db } from "../lib/db";
import { dailyReads, dailyRosters } from "../lib/schema";
import { rosterAt, type BaseAlliance } from "./seed-data";

const DAY = 86_400_000;
const WEEKS = [
  { event: 0, sunday: "2026-10-18" },
  { event: 1, sunday: "2026-10-25" },
];

/** Alliance `i`'s roster, its might `share` of the way from event `event`'s End to event `event + 1`'s Start. */
function rosterRow(base: BaseAlliance[], i: number, event: number, share: number) {
  const from = rosterAt(base, i, event, "after");
  const next = new Map(rosterAt(base, i, event + 1, "before").members.map((m) => [m.uid, m]));
  const step = (a: number, b: number) => Math.round(a + (b - a) * share);
  const members = from.members.map((m) => {
    const to = next.get(m.uid) ?? m;
    return { ...m, power: step(m.power, to.power) };
  });
  const a = base[i] as BaseAlliance;
  return {
    unionId: a.unionId,
    tag: from.tag,
    name: from.name,
    badgeId: i === 4 ? null : a.badgeId, // as the event rows: alliance 4 without a badge
    memberCount: members.length,
    totalPower: members.reduce((s, m) => s + m.power, 0),
    totalKills: members.reduce((s, m) => s + m.kills, 0),
    isFresh: true,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.name),
    memberPower: members.map((m) => m.power),
    memberKills: members.map((m) => m.kills),
  };
}

/**
 * Members who change alliance from the fourth day of the second week on (D89, the member flow page): six of
 * the second alliance and five of the third join the first, three of the fourth join the first too (a move
 * the page hides), five of the fifth leave the tracked alliances, and five new members (uids from 9 000 000)
 * join the fourth. The members that move are the last of their roster.
 */
const MOVES = [
  { from: 1, to: 0, n: 6 },
  { from: 2, to: 0, n: 5 },
  { from: 3, to: 0, n: 3 },
  { from: 4, to: null, n: 5 },
] as const;
const ARRIVALS = { to: 3, n: 5, firstUid: 9_000_000 };

type Row = ReturnType<typeof rosterRow>;
const COLUMNS = ["memberUids", "memberNames", "memberPower", "memberKills"] as const;

/** `rows` after the scripted moves; the counts and the might follow the members. */
function moveMembers(rows: Row[]): Row[] {
  const out = rows.map((r) => ({ ...r }));
  for (const { from, to, n } of MOVES) {
    const [source, target] = [out[from] as Row, to === null ? null : (out[to] as Row)];
    for (const c of COLUMNS) {
      const moved = (source[c] as unknown[]).splice(-n, n);
      if (target) (target[c] as unknown[]).push(...moved);
    }
  }
  const arrivals = out[ARRIVALS.to] as Row;
  for (let i = 0; i < ARRIVALS.n; i++) {
    arrivals.memberUids.push(ARRIVALS.firstUid + i);
    arrivals.memberNames.push(`Newcomer ${i + 1}`);
    arrivals.memberPower.push(1_000_000);
    arrivals.memberKills.push(0);
  }
  for (const r of out) {
    r.memberCount = r.memberUids.length;
    r.totalPower = r.memberPower.reduce((s, p) => s + p, 0);
    r.totalKills = r.memberKills.reduce((s, k) => s + k, 0);
  }
  return out;
}

/** Twelve complete daily reads of every seeded alliance, at 08:01 UTC (06:01 server time). */
export async function seedDaily(db: Db, base: BaseAlliance[]): Promise<void> {
  for (const { event, sunday } of WEEKS) {
    for (let d = 0; d < 6; d++) {
      const at = new Date(new Date(`${sunday}T08:01:00Z`).getTime() + d * DAY);
      const day = at.toISOString().slice(0, 10);
      await db.insert(dailyReads).values({
        day,
        startedAt: at,
        finishedAt: new Date(at.getTime() + 50_000),
        status: "complete",
        callsUsed: base.length + 1,
      });
      const rows = base.map((_, i) => rosterRow(base, i, event, (d + 1) / 7));
      await db.insert(dailyRosters).values(
        (event === 1 && d >= 3 ? moveMembers(rows) : rows).map((row) => ({
          ...row,
          readDay: day,
          sourceUpdatedAt: new Date(at.getTime() + 30_000),
        })),
      );
    }
  }
}
