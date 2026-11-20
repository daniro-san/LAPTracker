// The Raid Shield check's line in the read status bar (D135, D137) against PGlite: one test per state.
// Friday's read under way, Friday's read done, Saturday's read under way, and no line while the check is
// off or once KvK has started. Counts and server times only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { shieldChecks } from "../schema-shield";
import { playerReads, squadReads } from "../schema-squads";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { readStatus } from "./read-status";

/** Friday 2026-11-20's read (UTC−2): the check's quota day. */
const DAY = "2026-11-20";
const at = (iso: string) => new Date(iso);
const t = WORKSPACE_DICTIONARIES.en;
const access = (on = true) =>
  ({
    workspaceId: 1,
    unionId: OWN_ALLIANCE_ID,
    features: { on: new Set(on ? ["shield_check"] : []), caps: { ai: 0, translate: 0 } },
  }) as unknown as WorkspaceAccess;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(dailyReads)
    .values({ day: DAY, startedAt: at("2026-11-21T01:30:00Z"), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    isFresh: true,
    memberUids: [1, 2, 3, 4],
    memberNames: ["A", "B", "C", "D"],
    memberPower: [1, 1, 1, 1],
    memberKills: [1, 1, 1, 1],
  });
  // Friday's read: 1 seen with a shield, 2 not, at 23:31 and 23:42 ST.
  const base = { unionId: OWN_ALLIANCE_ID, mapUpdatedAt: at("2026-11-21T00:32:00Z") };
  await db.insert(playerReads).values([
    { ...base, uid: 1, readAt: at("2026-11-21T01:31:00Z"), shielding: 1 },
    { ...base, uid: 2, readAt: at("2026-11-21T01:35:00Z"), shielding: 0 },
    { ...base, uid: 3, readAt: at("2026-11-21T01:42:00Z"), shielding: 0 },
  ]);
});

async function night(status: "running" | "done") {
  const startedAt = at("2026-11-21T01:31:00Z");
  await db
    .insert(squadReads)
    .values({ day: DAY, unionId: OWN_ALLIANCE_ID, status, startedAt, members: 4 });
  await db.insert(shieldChecks).values({ day: DAY, unionId: OWN_ALLIANCE_ID, nightAt: startedAt });
}

const shieldLine = async (now: Date, on = true) =>
  (await readStatus(db, access(on), TEST_ENV, now, t)).lines.find((l) => l.id === "shield");

describe("the Raid Shield check's status line (D137)", () => {
  it("Friday's read under way: counts and when it started", async () => {
    await night("running");
    expect(await shieldLine(at("2026-11-21T01:45:00Z"))).toEqual({
      id: "shield",
      tone: "progress",
      text: "Checking Raid Shields · 3 of 4 · started 23:31 ST",
    });
  });

  it("Friday's read done: the newest answer's time and who was seen with a shield", async () => {
    await night("done");
    expect(await shieldLine(at("2026-11-21T01:50:00Z"))).toEqual({
      id: "shield",
      tone: "quiet",
      text: "Raid Shield check 23:42 ST · 1 of 4 seen with a shield",
    });
  });

  it("Saturday's read under way, from its own start", async () => {
    await night("done");
    await db
      .update(shieldChecks)
      .set({ morningStatus: "running", morningStartedAt: at("2026-11-21T12:00:00Z") });
    const base = { unionId: OWN_ALLIANCE_ID, mapUpdatedAt: at("2026-11-21T11:40:00Z") };
    await db
      .insert(playerReads)
      .values({ ...base, uid: 1, readAt: at("2026-11-21T12:01:00Z"), shielding: 0 });
    expect(await shieldLine(at("2026-11-21T12:05:00Z"))).toMatchObject({
      tone: "progress",
      text: "Checking Raid Shields · 1 of 4 · started 10:00 ST",
    });
  });

  it("no line while the check is off, or once KvK has started", async () => {
    await night("done");
    expect(await shieldLine(at("2026-11-21T01:50:00Z"), false)).toBeUndefined();
    expect(await shieldLine(at("2026-11-21T14:00:00Z"))).toBeUndefined();
  });
});
