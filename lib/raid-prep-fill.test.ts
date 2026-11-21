// Raid prep's fill from the tracker (D137, amendments 2026-11-21) against a real Postgres (PGlite), stubs
// only: the tick fills the week's Raid prep after each Raid Shield reading and makes it when missing. The
// night check writes ✓ only for those seen with a shield; the morning check writes ✓ or ✗ No shield seen,
// as new versions. Both as the tracker's, never over an officer's mark, never for an away member, never
// twice, and nothing with the check off.
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { fillRaidPrep } from "./raid-prep-fill";
import { setSwitch } from "./repo/workspace-features";
import { saveWorkspace } from "./repo/workspaces";
import { calendarEntries, dailyReads, dailyRosters, memberFacts } from "./schema";
import { rollCallMarks, rollCalls } from "./schema-rollcall";
import { playerReads } from "./schema-squads";
import { shieldTick } from "./shield-tick";
import type { SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

const DAY = "2026-11-20";
/** Friday 23:39 ST (UTC−2) and Saturday 10:05 ST. */
const FRI = new Date("2026-11-21T01:39:00Z");
const SAT = new Date("2026-11-21T12:05:00Z");
/** Saturday 10:04 ST: the morning reading, just before its fill. */
const MORNING = new Date("2026-11-21T12:04:00Z");
const ZONE = TEST_ENV.SERVER_TZ;
const UIDS = [101, 102, 103, 104, 105];

let db: Db;
let ws: number;
const scope = () => ({ workspaceId: ws, unionId: OWN_ALLIANCE_ID });
const fill = (now: Date) => fillRaidPrep(db, scope(), DAY, { now, zone: ZONE });
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OWN_ALLIANCE_ID,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  ws = (await db.query.workspaces.findFirst())?.id ?? 0;
  await db.insert(dailyReads).values({
    day: DAY,
    startedAt: new Date(`${DAY}T23:30:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: new Date(`${DAY}T23:00:00-02:00`),
    memberUids: UIDS,
    memberNames: UIDS.map((u) => `Wren${u}`),
    memberPower: UIDS.map(() => 1),
    memberKills: UIDS.map(() => 0),
  });
});

/** Friday 23:31 ST readings: `on` seen with a shield, the rest of `read` not seen. */
async function readings(at: Date, on: number[], read: number[] = on) {
  await db.insert(playerReads).values(
    read.map((uid) => ({
      unionId: OWN_ALLIANCE_ID,
      uid,
      readAt: at,
      shielding: on.includes(uid) ? 1 : 0,
      shieldType: 0,
      mapUpdatedAt: at,
    })),
  );
}

const marks = () =>
  db.select().from(rollCallMarks).orderBy(rollCallMarks.uid, rollCallMarks.version);
const calls = () => db.select().from(rollCalls);

/** The tick's stubs: every member answers, odd uids seen with a shield. Nothing reaches Discord. */
function deps(now: Date) {
  const d: SquadsDeps & { at: Date; origin: string } = {
    at: now,
    origin: "https://laptracker.test",
    now: () => d.at,
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 },
    paceMs: 0,
    fetch: () => Promise.reject(new Error("no fetch")),
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        const facts = { ...playerAnswer(uid).facts, shielding: uid % 2, shieldType: 0 };
        return playerAnswer(uid, [], { limit: 1000, used: 100, remaining: 900 }, { facts });
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}
const tick = (d: ReturnType<typeof deps>) =>
  shieldTick(d as Parameters<typeof shieldTick>[0], db, d.at.getTime() + 180_000);

describe("Raid prep's fill from the tracker (D137, 2026-11-21)", () => {
  it("adds the week's Raid prep in Friday's tick and marks ✓ only those seen, as the tracker's", async () => {
    await tick(deps(FRI));
    const [call, ...more] = await calls();
    expect(more).toEqual([]);
    expect(call).toMatchObject({ kind: "shield", day: "2026-11-21", createdBy: null });
    expect((await marks()).map((m) => [m.uid, m.mark, m.byTracker, m.writtenBy])).toEqual([
      [101, "yes", true, null],
      [103, "yes", true, null],
      [105, "yes", true, null],
    ]);
  });

  it("does nothing while the Raid Shield check is off", async () => {
    await setSwitch(db, ws, "shield_check", false, FRI);
    await tick(deps(FRI));
    expect(await calls()).toEqual([]);
  });

  it("marks Saturday's ✗ No shield seen for a Friday ✓ the morning reading no longer sees", async () => {
    await readings(FRI, [101, 102]);
    expect(await fill(FRI)).toBe(2);
    // Saturday 10:04 ST: 101's shield is still seen, 102's is not.
    await readings(MORNING, [101], [101, 102]);
    expect(await fill(SAT)).toBe(2);
    expect((await marks()).map((m) => [m.uid, m.version, m.mark, m.byTracker])).toEqual([
      [101, 1, "yes", true],
      [101, 2, "yes", true],
      [102, 1, "yes", true],
      [102, 2, "no", true],
    ]);
  });

  it("writes nothing over an officer's mark, in either check", async () => {
    await readings(FRI, [101, 102, 103], UIDS);
    const [call] = await db
      .insert(rollCalls)
      .values({ workspaceId: ws, kind: "shield", day: "2026-11-21", week: "2026-11-16" })
      .returning();
    const officer = { rollCallId: call?.id ?? 0, part: "main" as const, writtenAt: FRI };
    await db.insert(rollCallMarks).values([
      { ...officer, uid: 101, version: 1, mark: "no" },
      { ...officer, uid: 102, version: 1, mark: "yes" },
      { ...officer, uid: 102, version: 2, mark: null },
    ]);
    expect(await fill(FRI)).toBe(1);
    await readings(MORNING, [101], UIDS);
    expect(await fill(SAT)).toBe(3);
    const tracker = (await marks()).filter((m) => m.byTracker);
    expect(tracker.map((m) => m.uid)).not.toContain(101);
    expect(tracker.map((m) => m.uid)).not.toContain(102);
  });

  it("leaves out a member away that day, in both checks", async () => {
    await readings(FRI, [101, 102]);
    await db.insert(memberFacts).values({
      workspaceId: ws,
      uid: 102,
      field: "away",
      version: 1,
      value: { text: "Trip", from: "2026-11-19", until: "2026-11-23" },
      source: "officer",
      writtenAt: FRI,
    });
    expect(await fill(FRI)).toBe(1);
    await readings(MORNING, [], [101, 102]);
    expect(await fill(SAT)).toBe(1);
    expect((await marks()).map((m) => m.uid)).toEqual([101, 101]);
  });

  it("adds no version twice when a check's fill runs again", async () => {
    await readings(FRI, [101, 102], [101, 102, 103]);
    expect(await fill(FRI)).toBe(2);
    expect(await fill(new Date(FRI.getTime() + 15 * 60_000))).toBe(0);
    await readings(MORNING, [101, 103], [101, 102, 103]);
    expect(await fill(SAT)).toBe(3);
    expect(await fill(new Date(SAT.getTime() + 15 * 60_000))).toBe(0);
    expect(await calls()).toHaveLength(1);
    expect(await marks()).toHaveLength(5);
  });

  it("fills the week's KvK Calendar roll call instead of adding a second Raid prep", async () => {
    await readings(FRI, [101]);
    const [entry] = await db
      .insert(calendarEntries)
      .values({ workspaceId: ws, kind: "kvk", day: "2026-11-14", minute: 720, weekly: true })
      .returning();
    expect(await fill(FRI)).toBe(1);
    const [call, ...more] = await calls();
    expect(more).toEqual([]);
    expect(call).toMatchObject({ entryId: entry?.id, week: "2026-11-16", day: "2026-11-21" });
    const own = and(eq(rollCallMarks.rollCallId, call?.id ?? 0), eq(rollCallMarks.uid, 101));
    expect(await db.select().from(rollCallMarks).where(own)).toHaveLength(1);
  });
});
