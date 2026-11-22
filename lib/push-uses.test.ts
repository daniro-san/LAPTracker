// The four officers' notifications (D148) against a real Postgres (PGlite) and a push service stub: each fires
// once per trigger (the Raid Shield count again only when it changed, away members left out), only to the
// workspace concerned, and what reaches the device holds counts and a link, never a member's name or uid.
// Invented names; no real push service.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DailyReadSummary } from "./daily-read";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { rollCallReminders } from "./push-tick";
import { pushClaim, pushNightRead, pushShield } from "./push-uses";
import {
  browserDevice,
  PUSH_ENV,
  pushService,
  saveTestDevice,
  sessionFor,
} from "./push.test-helpers";
import {
  calendarEntries,
  dailyReads,
  dailyRosters,
  memberFacts,
  workspaces,
  workspaceUsers,
} from "./schema";
import { workspaceFeatures } from "./schema-features";
import { PUSH_USES } from "./schema-push";
import { playerReads } from "./schema-squads";
import type { ShieldTarget } from "./shield-read";

const DAY = "2026-11-20";
/** Friday 23:40 ST (UTC−2). */
const FRI = new Date("2026-11-21T01:40:00Z");
const NAMES = ["Wren Invented", "Moss Invented"];
const UIDS = [9_100_001, 9_100_002];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** A workspace with one officer, signed in, whose device is on for every use. */
async function workspace(slug: string, unionId: number, at: Date) {
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `${slug}-officer` })
    .returning({ id: workspaceUsers.id });
  const userId = user?.id ?? 0;
  await sessionFor(db, { workspaceId, userId }, at, "officer");
  const device = browserDevice(slug);
  await saveTestDevice(db, { workspaceId, userId, device, uses: [...PUSH_USES] });
  return { workspaceId, userId, device, unionId, slug };
}
type Ws = Awaited<ReturnType<typeof workspace>>;

let alpha: Ws;
let bravo: Ws;
let push: ReturnType<typeof pushService>;
let clock: { now: Date };
const deps = () => ({ env: PUSH_ENV, fetch: push.fetch, now: () => clock.now });

/** No name or uid of the roster anywhere in what a device received. */
const countsOnly = (got: unknown) => {
  const text = JSON.stringify(got);
  for (const v of [...NAMES, ...UIDS.map(String)]) expect(text).not.toContain(v);
};

beforeEach(async () => {
  await truncateAll(db);
  clock = { now: FRI };
  push = pushService();
  alpha = await workspace("alpha", 900_001, new Date("2026-11-19T12:00:00Z"));
  bravo = await workspace("bravo", 900_002, new Date("2026-11-19T12:00:00Z"));
  await db.insert(dailyReads).values({ day: DAY, startedAt: FRI, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: alpha.unionId,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: FRI,
    memberUids: UIDS,
    memberNames: NAMES,
    memberPower: [1, 1],
    memberKills: [0, 0],
  });
});

describe("the officers' notifications (D148)", () => {
  it("Raid Shield: once when a read is over, again only when its count changed", async () => {
    const target: ShieldTarget = {
      unionId: alpha.unionId,
      workspaceId: alpha.workspaceId,
      slug: "alpha",
      key: null,
      settings: null,
    };
    const reading = { unionId: alpha.unionId, readAt: FRI, shieldType: 0 };
    await db.insert(playerReads).values([
      { ...reading, uid: UIDS[0] as number, shielding: 0 },
      { ...reading, uid: UIDS[1] as number, shielding: 1 },
    ]);
    const run = { day: DAY, target, pass: "night" as const };
    await pushShield(deps(), db, run);
    await pushShield(deps(), db, run);
    // A later tick read Moss again: no shield seen now, so the count moved from 1 to 2.
    const later = new Date(FRI.getTime() + 60_000);
    await db
      .insert(playerReads)
      .values({ ...reading, uid: UIDS[1] as number, readAt: later, shielding: 0 });
    await pushShield(deps(), db, run);
    const got = push.received(alpha.device);
    expect(got.map((n) => n.body)).toEqual([
      "Night check: 1 not seen with a shield yet. Tap to review in Raid prep.",
      "Night check: 2 not seen with a shield yet. Tap to review in Raid prep.",
    ]);
    expect(got[0]?.url).toBe("/w/alpha/roll-call?week=2026-11-16");
    expect(push.received(bravo.device)).toEqual([]);
    countsOnly(got);
  });

  it("Raid Shield: leaves a member away on the raid's Saturday out of the count, as the summary does", async () => {
    const target: ShieldTarget = {
      unionId: alpha.unionId,
      workspaceId: alpha.workspaceId,
      slug: "alpha",
      key: null,
      settings: null,
    };
    // Away from Saturday only: on Friday, the night check's own day, Moss is not away yet.
    await db.insert(memberFacts).values({
      ...{ workspaceId: alpha.workspaceId, uid: UIDS[1] as number, field: "away", version: 1 },
      ...{ value: { text: "Trip", from: "2026-11-21", until: "2026-11-23" } },
      ...{ source: "officer", writtenAt: FRI },
    });
    const reading = { unionId: alpha.unionId, readAt: FRI, shieldType: 0, shielding: 0 };
    await db.insert(playerReads).values(UIDS.map((uid) => ({ ...reading, uid })));
    const run = { day: DAY, target, pass: "night" as const };
    await pushShield(deps(), db, run);
    // A later tick sees Wren with a shield: only away Moss is not seen, so "every member" would be untrue.
    const later = new Date(FRI.getTime() + 60_000);
    await db
      .insert(playerReads)
      .values({ ...reading, uid: UIDS[0] as number, readAt: later, shielding: 1 });
    await pushShield(deps(), db, run);
    expect(push.received(alpha.device).map((n) => n.body)).toEqual([
      "Night check: 1 not seen with a shield yet. Tap to review in Raid prep.",
      "Night check: 0 not seen with a shield yet. Tap to review in Raid prep.",
    ]);
  });

  it("night read failed: once per day, only to the workspace whose alliance failed", async () => {
    const summary: DailyReadSummary = {
      day: DAY,
      status: "partial",
      callsUsed: 3,
      error: null,
      failed: [{ unionId: alpha.unionId, tag: "ALP", error: "v1 http 502" }],
      stale: [],
    };
    await pushNightRead(deps(), db, summary);
    await pushNightRead(deps(), db, summary);
    const got = push.received(alpha.device);
    expect(got.map((n) => [n.title, n.url])).toEqual([["Roster read failed", "/w/alpha"]]);
    expect(push.received(bravo.device)).toEqual([]);
  });

  it("“This is me”: once per member and day, with the count waiting", async () => {
    const [member] = await db
      .insert(workspaceUsers)
      .values({
        workspaceId: alpha.workspaceId,
        discordUserId: "alpha-member",
        playerUid: UIDS[0],
        playerLink: "pending",
        playerLinkedAt: FRI,
      })
      .returning({ id: workspaceUsers.id });
    const ws = { id: alpha.workspaceId, slug: "alpha" };
    await pushClaim(deps(), db, ws, member?.id ?? 0);
    await pushClaim(deps(), db, ws, member?.id ?? 0);
    const got = push.received(alpha.device);
    expect(got.map((n) => [n.body, n.url])).toEqual([
      ["A member asked to link their player. 1 waiting in To review.", "/w/alpha#to-review"],
    ]);
    expect(push.received(bravo.device)).toEqual([]);
    countsOnly(got);
  });

  it("roll call: “open” once when it opens (no number), “left” once about a day later, counts only", async () => {
    // An Undead Siege on Thursday 20:00 ST (22:00 UTC): open until Friday 20:00 ST.
    const [entry] = await db
      .insert(calendarEntries)
      .values({ workspaceId: alpha.workspaceId, kind: "undead", day: "2026-11-19", minute: 1200 })
      .returning({ id: calendarEntries.id });
    const at = (iso: string) => (clock.now = new Date(iso));
    for (const t of ["2026-11-19T21:00:00Z", "2026-11-19T22:30:00Z", "2026-11-19T23:30:00Z"]) {
      at(t);
      await rollCallReminders(deps(), db);
    }
    for (const t of ["2026-11-20T15:00:00Z", "2026-11-20T20:00:00Z", "2026-11-20T21:30:00Z"]) {
      at(t);
      await rollCallReminders(deps(), db);
    }
    const got = push.received(alpha.device);
    expect(got.map((n) => [n.title, n.body])).toEqual([
      ["Roll call: Undead Siege", "Open now. Tap to mark who took part."],
      ["Roll call: Undead Siege", "2 still not set. Tap to open the roll call."],
    ]);
    expect(got[0]?.url).toBe(`/w/alpha/roll-call/mark?entry=${entry?.id}&week=2026-11-16`);
    expect(push.received(bravo.device)).toEqual([]);
    countsOnly(got);
  });

  it("roll call: no Raid prep reminder while the Raid Shield check is on (its own notification covers it)", async () => {
    // KvK on Saturday 12:00 ST: Raid prep opens Friday 12:00 ST (14:00 UTC).
    await db
      .insert(calendarEntries)
      .values({ workspaceId: alpha.workspaceId, kind: "kvk", day: "2026-11-21", minute: 720 });
    const on = { shield_check: true };
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId: alpha.workspaceId, switches: on, allianceSwitches: on });
    clock.now = new Date("2026-11-20T14:30:00Z");
    await rollCallReminders(deps(), db);
    expect(push.received(alpha.device)).toEqual([]);
    await db.delete(workspaceFeatures);
    await rollCallReminders(deps(), db);
    expect(push.received(alpha.device).map((n) => n.title)).toEqual(["Roll call: Raid prep"]);
  });
});
