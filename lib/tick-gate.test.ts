// The tick's clock-first gate (D141, issue 521): every window it opens the database for, and no query at
// all outside them: before the day's read, near the 00:00 UTC reset, once the squads queue is settled, and
// once no rehearsal is pending.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { noQueryDb, openTestDb, truncateAll } from "./db.test-helpers";
import { createRehearsal } from "./rehearsal";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads } from "./schema";
import { squadReads } from "./schema-squads";
import { squadsMayRun, tickClockDue, tickMayBeDue } from "./tick-gate";

const at = (iso: string) => new Date(`${iso}Z`);

describe("tickClockDue (D141)", () => {
  // Server UTC−2. Event Saturday 10:00–14:00 ST (12:00–16:00 UTC), window 45 min; Friday check 20:00 ST;
  // REHEARSAL_AT fri 18:00 ST; daily read 23:30 ST (01:30 UTC).
  it("opens for each of the tick's windows and stays shut between them", () => {
    const due = (iso: string, env = TEST_ENV) => tickClockDue(at(iso), env);
    expect(due("2026-11-18T16:07")).toBe(false); // Wednesday 14:07 ST: nothing
    expect(due("2026-11-18T03:05")).toBe(true); // the 3-hourly heartbeat
    expect(due("2026-11-18T04:05")).toBe(false);
    expect(due("2026-11-18T18:20")).toBe(false);
    expect(due("2026-11-19T01:40")).toBe(true); // Wednesday 23:40 ST: the daily read
    expect(due("2026-11-20T12:10")).toBe(true); // Friday 10:10 ST: the event's row, a day ahead
    expect(due("2026-11-20T14:07")).toBe(false);
    expect(due("2026-11-20T20:05")).toBe(true); // Friday 18:05 ST: the rehearsal slot
    expect(due("2026-11-20T22:30")).toBe(true); // Friday 20:30 ST: the Friday check
    expect(due("2026-11-21T13:00")).toBe(true); // Saturday, between Before and After
    expect(due("2026-11-21T16:44")).toBe(true); // After's window
    expect(due("2026-11-21T16:46")).toBe(false);
  });

  it("keeps a REHEARSAL_AT slot open until its rehearsal's After window closes", () => {
    const env = { ...TEST_ENV, REHEARSAL_AT: "wed 18:00" };
    // Slot 20:00 UTC; created by 20:45 at the latest, After at +45 min, its window 45 min: until 22:15.
    expect(tickClockDue(at("2026-11-18T22:14"), env)).toBe(true);
    expect(tickClockDue(at("2026-11-18T22:16"), env)).toBe(false);
  });
});

let db: Db;
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
});

/** Wednesday's read (server date 2026-11-18), run at 23:30 ST = 01:30 UTC on the 19th. */
const DAY = "2026-11-18";
const dayRead = () =>
  db.insert(dailyReads).values({
    day: DAY,
    startedAt: at("2026-11-19T01:30"),
    status: "complete",
    callsUsed: 21,
  });
const squads = (status: "running" | "done") =>
  db.insert(squadReads).values({
    day: DAY,
    unionId: OWN_ALLIANCE_ID,
    status,
    startedAt: at("2026-11-19T01:31"),
    members: 3,
  });

describe("squadsMayRun (D141)", () => {
  it("makes no query before the quota day's read or near the 00:00 UTC reset", async () => {
    const { ctx, clock } = testContext(db);
    clock.now = at("2026-11-19T00:30"); // Wednesday 22:30 ST: its read is at 23:30
    expect(await squadsMayRun(ctx, noQueryDb)).toBe(false);
    clock.now = at("2026-11-19T23:59:30"); // a batch would cross the reset
    expect(await squadsMayRun(ctx, noQueryDb)).toBe(false);
  });

  it("runs while a queue is running, then keeps 'settled' and asks the database no more that day", async () => {
    const { ctx, clock } = testContext(db);
    clock.now = at("2026-11-19T04:00");
    await dayRead();
    await squads("running");
    expect(await squadsMayRun(ctx, db)).toBe(true);
    await db.update(squadReads).set({ status: "done" });
    expect(await squadsMayRun(ctx, db)).toBe(false);
    clock.now = at("2026-11-19T15:00");
    expect(await squadsMayRun(ctx, noQueryDb)).toBe(false);
  });

  it("stays settled when the day's read never came and its window closed", async () => {
    const { ctx, clock } = testContext(db);
    clock.now = at("2026-11-19T13:00");
    expect(await squadsMayRun(ctx, db)).toBe(false);
    expect(await squadsMayRun(ctx, noQueryDb)).toBe(false);
  });
});

describe("tickMayBeDue (D141)", () => {
  it("asks nothing once no rehearsal is pending, and looks again after a press forgets", async () => {
    const { ctx, clock } = testContext(db);
    // Wednesday 14:07 ST: no window, and the quota day's read (Tuesday's) never came.
    clock.now = at("2026-11-18T16:07");
    expect(await tickMayBeDue(ctx, db)).toBe(false);
    expect(await tickMayBeDue(ctx, noQueryDb)).toBe(false);

    // /admin's "Rehearse now" (POST /api/rehearsal) forgets the kept facts.
    expect((await createRehearsal(db, clock.now, ctx.env)).ok).toBe(true);
    ctx.wakeCache.forget();
    expect(await tickMayBeDue(ctx, db)).toBe(true);
  });

  it("opens for the Raid Shield check's Friday 23:30 ST and Saturday morning reads from the clock (D137)", async () => {
    const { ctx, clock } = testContext(db);
    clock.now = at("2026-11-21T01:40"); // Friday 23:40 ST
    expect(await tickMayBeDue(ctx, noQueryDb)).toBe(true);
    clock.now = at("2026-11-21T12:20"); // Saturday 10:20 ST, the morning read
    expect(await tickMayBeDue(ctx, noQueryDb)).toBe(true);
  });
});
