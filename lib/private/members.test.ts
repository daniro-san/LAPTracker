import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const NSE = 67109944;
const NOW = new Date("2026-11-16T12:00:00Z");
const DAY = 86_400_000;
const dayOf = (n: number) => new Date(Date.UTC(2026, 10, 9) + n * DAY).toISOString().slice(0, 10);

/** uid → the roster fields the read keeps; a member's might and kills arrays come from the same values. */
type Members = Record<number, { tech?: number | null; active?: number; power?: number }>;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
});

/** A signed-in officer's access to the workspace `slug`, made the way a sign-in makes it. */
async function signedIn(slug: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

/** One alliance's end-of-day read on server day `day` (D72): the member arrays and raw_json. */
async function endOfDay(unionId: number, day: string, members: Members) {
  const uids = Object.keys(members).map(Number);
  const at = new Date(`${day}T23:37:00-02:00`);
  await db
    .insert(dailyReads)
    .values({ day, startedAt: at, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: uids.length,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => members[u]?.power ?? 1000),
    memberKills: uids.map(() => 0),
    rawJson: {
      members: uids.map((uid) => ({
        uid,
        nick_name: `P${uid}`,
        power: members[uid]?.power ?? 1000,
        lv: 25,
        rank_code: 103,
        rank_label: "R3",
        daily_tech: members[uid]?.tech ?? null,
        active: members[uid]?.active ?? 10 + Number(day.slice(8)),
        avatar_url: "https://phs-image.globallap.com/a.png",
      })),
    },
  });
}

describe("the Members tab, between two workspaces (D71)", () => {
  it("shows a player who moved to the old alliance only up to the move, and to the new one only after it", async () => {
    // Player 900 donates in OGs on Monday and Tuesday, then moves to NSE and donates there.
    await endOfDay(OGS, dayOf(0), { 1: { tech: 50 }, 900: { tech: 500 } });
    await endOfDay(OGS, dayOf(1), { 1: { tech: 50 }, 900: { tech: 600 } });
    await endOfDay(NSE, dayOf(0), { 2: { tech: 70 } });
    await endOfDay(NSE, dayOf(1), { 2: { tech: 70 } });
    const [ogs, nse] = [await signedIn("ogs"), await signedIn("nse")];

    const before = await membersView(db, ogs, NOW);
    expect(before.members.find((m) => m.uid === 900)?.donations.slice(0, 2)).toEqual([500, 600]);

    await endOfDay(OGS, dayOf(2), { 1: { tech: 50 } });
    await endOfDay(OGS, dayOf(3), { 1: { tech: 50 } });
    await endOfDay(NSE, dayOf(2), { 2: { tech: 70 }, 900: { tech: 700 } });
    await endOfDay(NSE, dayOf(3), { 2: { tech: 70 }, 900: { tech: 800 } });

    const [old, now] = [await membersView(db, ogs, NOW), await membersView(db, nse, NOW)];
    expect(old.members.map((m) => m.uid)).toEqual([1]);
    const moved = now.members.find((m) => m.uid === 900);
    // NSE sees none of the OGs days, counts only its own, and sees the player as new since Wednesday.
    expect(moved?.donations).toEqual([null, null, 700, 800, "later", "later", "later"]);
    expect(moved?.weekTotal).toBe(1500);
    expect(moved?.seenSince).toBe(dayOf(2));
    expect(moved?.isNew).toBe(true);
    expect(JSON.stringify(now)).not.toContain("avatar");
  });
});

/** A scheduled event on Saturday with Start and End rosters of OGs: uid → [kills before, kills after]. */
async function kvk(kills: Record<number, [number | null, number | null]>) {
  const at = new Date("2026-11-14T14:00:00Z");
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [OGS], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: snap?.id ?? 0,
        unionId: OGS,
        tag: "OGs",
        source: "v1",
        isFresh: true,
        memberCount: 3,
        sourceUpdatedAt: at,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(kills).map(([uid, k]) => ({
        allianceSnapshotId: row?.id ?? 0,
        uid: Number(uid),
        name: `P${uid}`,
        lv: 25,
        power: 1000,
        kills: k[i] ?? null,
      })),
    );
  }
}

describe("Check in reasons (D75)", () => {
  it("gives a member with no kills gained in the week's scheduled event a reason with its date", async () => {
    await endOfDay(OGS, dayOf(5), { 1: { tech: 5 }, 2: { tech: 5 }, 3: { tech: 5 } });
    await kvk({ 1: [100, 100], 2: [100, 150], 3: [null, 100] });

    const view = await membersView(db, await signedIn("ogs"), NOW);

    const reasons = new Map(view.members.map((m) => [m.uid, m.reasons]));
    expect(reasons.get(1)).toEqual([{ kind: "kvk", at: new Date("2026-11-14T14:00:00Z") }]);
    // Kills gained, and kills unknown at the Start (which never counts), give no reason.
    expect(reasons.get(2)).toEqual([]);
    expect(reasons.get(3)).toEqual([]);
  });

  it("lists D70's might unchanged as a reason, and a member whose might grew as fine", async () => {
    // 16 daily reads (days −14 … 1): member 1's might never moves; member 2's grows every day.
    for (let n = -14; n <= 1; n++)
      await endOfDay(OGS, dayOf(n), { 1: { tech: 5, power: 800 }, 2: { tech: 5, power: 900 + n } });

    const view = await membersView(db, await signedIn("ogs"), NOW);

    const reasons = new Map(view.members.map((m) => [m.uid, m.reasons]));
    expect(reasons.get(1)).toEqual([{ kind: "might", days: 15 }]);
    expect(reasons.get(2)).toEqual([]);
  });
});
