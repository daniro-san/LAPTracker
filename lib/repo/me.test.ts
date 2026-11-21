// A member's own page reads against PGlite (D142, issue 585): a caravan seat and a roll call take their time
// from the week's moved occurrence, not from the planned entry, so "Started" and "Ended" follow the move.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { calendarEntries, calendarOccurrences, rollCallMarks, rollCalls } from "../schema";
import { ownMarks, ownSeats } from "./me";
import { findWorkspaceBySlug, saveWorkspace } from "./workspaces";

const WEEK = "2026-11-02";
const SATURDAY = "2026-11-07";

let db: Db;
let ws = 0;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: 1, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] });
  ws = (await findWorkspaceBySlug(db, "alpha"))?.id ?? 0;
});

describe("a member's own week (D142)", () => {
  it("times a moved caravan seat and a moved event's roll call by the move, not the plan", async () => {
    // A weekly caravan planned Tuesday 14:00 ST, moved this week to Saturday 20:00 ST with uid 101 as
    // Coachman; Saturday's KvK planned at 12:00 ST, moved this week to 18:00 ST, with 101's Raid prep mark.
    const [caravan, kvk] = await db
      .insert(calendarEntries)
      .values([
        { workspaceId: ws, kind: "caravan", day: "2026-11-03", minute: 840, weekly: true },
        { workspaceId: ws, kind: "kvk", day: SATURDAY, minute: 720 },
      ])
      .returning({ id: calendarEntries.id });
    const moved = { workspaceId: ws, week: WEEK, day: SATURDAY };
    await db.insert(calendarOccurrences).values([
      { ...moved, entryId: caravan?.id ?? 0, minute: 1200, coachUid: 101, coachName: "Ana" },
      { ...moved, entryId: kvk?.id ?? 0, minute: 1080 },
    ]);
    const [prep] = await db
      .insert(rollCalls)
      .values({ workspaceId: ws, kind: "shield", day: SATURDAY, week: WEEK, entryId: kvk?.id })
      .returning({ id: rollCalls.id });
    await db.insert(rollCallMarks).values({
      rollCallId: prep?.id ?? 0,
      uid: 101,
      version: 1,
      mark: "yes",
      writtenAt: new Date("2026-11-06T23:40:00Z"),
    });

    const seats = await ownSeats(db, ws, 101, WEEK);
    expect(seats.map((s) => [s.movedTo, s.minute])).toEqual([[SATURDAY, 1200]]);
    const marks = await ownMarks(db, ws, 101, SATURDAY);
    expect(marks.map((m) => [m.day, m.minute])).toEqual([[SATURDAY, 1080]]);
  });
});
