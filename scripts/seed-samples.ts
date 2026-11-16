// The seed's sampled event (D69, issue 307): a reading every 15 minutes between the Start (12:00Z) and the
// End (16:00Z) of the latest seed event, shaped like a KvK: about an hour of heavy fighting from 14:00Z (12:00
// server), losses of ~3.5 B of might across the server, kills moving in steps, might moving at every reading
// for most members. Each alliance's numbers update every 10-13 minutes (measured 2026-11-16), so a 15-minute
// slot holds 0, 1 or 2 game updates. The last sample has one stale alliance and one failed. Deterministic.
// A local in-progress variant: delete the event's After and shift its times (see the 08zzzze handoff).
import type { Db } from "../lib/db";
import { allianceSnapshots, snapshots } from "../lib/schema";
import { rosterAt, noise, type BaseAlliance } from "./seed-data";

const MIN = 60_000;
const EVERY = 15;
/** Share of each 15 minutes' change that falls in each slot, 12:15Z..15:45Z: quiet, heavy 14:15-15:00Z, tail. */
const WEIGHTS = [1, 1, 1, 1, 2, 2, 3, 8, 14, 18, 20, 14, 6, 4, 2];
const MIGHT_LOSS = 3.5e9;

/** Cumulative share of the whole change `minute` minutes after the Start (linear inside a slot). */
function shareAt(minute: number): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  const slot = Math.min(Math.floor(minute / EVERY), WEIGHTS.length);
  const done = WEIGHTS.slice(0, slot).reduce((a, b) => a + b, 0);
  const inside = slot < WEIGHTS.length ? (WEIGHTS[slot] as number) * ((minute % EVERY) / EVERY) : 0;
  return (done + inside) / total;
}

/** The minute of the alliance's latest game update at or before `minute`: every 10-13 minutes. */
const updateAt = (index: number, minute: number) => {
  const [period, offset] = [10 + (index % 4), (index * 7) % 10];
  return Math.max(0, Math.floor((minute - offset) / period) * period + offset);
};

export async function seedSamples(
  db: Db,
  base: BaseAlliance[],
  eventId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const before = base.map((_, i) => rosterAt(base, i, 2, "before"));
  const after = base.map((_, i) => rosterAt(base, i, 2, "after"));
  const serverPower = before.reduce((s, r) => s + r.members.reduce((t, m) => t + m.power, 0), 0);
  const lossShare = MIGHT_LOSS / serverPower;
  let taken = 0;
  for (
    let slot = start.getTime() + EVERY * MIN;
    slot < end.getTime() - EVERY * MIN + 1;
    slot += EVERY * MIN
  ) {
    const minute = (slot - start.getTime()) / MIN;
    const last = slot + EVERY * MIN >= end.getTime();
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId,
        phase: "sample",
        slotAt: new Date(slot),
        startedAt: new Date(slot + 20_000),
        finishedAt: new Date(slot + 62_000),
        status: last ? "partial" : "complete",
        callsUsed: 21,
        durationMs: 42_000,
      })
      .returning({ id: snapshots.id });
    const snapshotId = (snap as { id: number }).id;
    const rows = base.flatMap((a, i): (typeof allianceSnapshots.$inferInsert)[] => {
      const [b, f] = [before[i], after[i]];
      if (!b || !f) return [];
      const common = {
        snapshotId,
        unionId: a.unionId,
        tag: b.tag,
        name: b.name,
        source: "v1" as const,
      };
      if (last && i === 11) return [{ ...common, isFresh: false, error: "v1 503 after 3 retries" }];
      const share = shareAt(updateAt(i, minute));
      const kills = new Map(f.members.map((m) => [m.uid, m.kills]));
      const members = b.members.map((m) => {
        const gain = Math.max(0, (kills.get(m.uid) ?? m.kills) - m.kills) * 12; // a KvK's kills, not a day's
        const fought = noise(m.uid, 77) > 0.35;
        const jitter = 1 - 0.0004 * noise(m.uid, slot / MIN);
        return {
          uid: m.uid,
          name: m.name,
          kills: m.kills + (fought ? Math.round(gain * share) : 0),
          power: Math.round(m.power * (1 - lossShare * 2 * noise(m.uid, 5) * share) * jitter),
        };
      });
      const stale = last && i === 9;
      return [
        {
          ...common,
          badgeId: a.badgeId,
          memberCount: members.length,
          totalPower: members.reduce((s, m) => s + m.power, 0),
          totalKills: members.reduce((s, m) => s + m.kills, 0),
          sourceUpdatedAt: new Date(slot + 40_000 - (stale ? 45 * MIN : 0)),
          cached: false,
          isFresh: !stale,
          memberUids: members.map((m) => m.uid),
          memberNames: members.map((m) => m.name),
          memberPower: members.map((m) => m.power),
          memberKills: members.map((m) => m.kills),
        },
      ];
    });
    await db.insert(allianceSnapshots).values(rows);
    taken += 1;
  }
  return taken;
}
