import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { trimRaw } from "../raw-json";
import { dailyRosters } from "../schema";
import { allianceMoves } from "./alliance-moves";
import { findBlockedKeys } from "./blocked-keys";

const TODAY = "2026-11-28";

async function daily(db: Db, day: string, unionId: number, tag: string, uids: number[]) {
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag,
    name: `${tag} name`,
    memberCount: uids.length,
    totalPower: 1,
    totalKills: 0,
    isFresh: true,
    sourceUpdatedAt: new Date(`${day}T23:00:00Z`),
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 0),
    // As /v1 sends it, private fields included: none of them may leave the read.
    rawJson: trimRaw({
      members: uids.map((uid) => ({ uid, x: 11, y: 22, online: true, joined_at: 1793000000 })),
    }),
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  // Alliance 7 (OGs): P10 joins from CROW (alliance 8) on Nov 8; on Nov 27 P30 joins from no tracked
  // alliance, P3 leaves for CROW and P10 leaves for no tracked alliance.
  await daily(db, "2026-11-05", 7, "OGs", [1, 2, 3]);
  await daily(db, "2026-11-05", 8, "CROW", [10]);
  await daily(db, "2026-11-08", 7, "OGs", [1, 2, 3, 10]);
  await daily(db, "2026-11-08", 8, "CROW", [20]);
  await daily(db, "2026-11-25", 7, "OGs", [1, 2, 3, 10]);
  await daily(db, "2026-11-27", 7, "OGs", [1, 2, 30]);
  await daily(db, "2026-11-27", 8, "CROW", [3, 20]);
  // Outside the 30 days: never compared.
  await daily(db, "2026-10-01", 7, "OGs", [99]);
});

describe("allianceMoves", () => {
  it("counts joined and left for the last 7 and 30 days", async () => {
    const moves = await allianceMoves(db, 7, TODAY);
    expect(moves?.week).toEqual({ joined: 1, left: 2 });
    expect(moves?.month).toEqual({ joined: 2, left: 2 });
    expect(moves?.compared).toBe(true);
  });

  it("lists each person by day, newest first, with the alliance they came from or went to", async () => {
    const moves = (await allianceMoves(db, 7, TODAY))?.moves;
    expect(moves).toEqual([
      { day: "2026-11-27", kind: "joined", uid: 30, name: "P30", other: null },
      { day: "2026-11-27", kind: "left", uid: 10, name: "P10", other: null },
      { day: "2026-11-27", kind: "left", uid: 3, name: "P3", other: { unionId: 8, tag: "CROW" } },
      {
        day: "2026-11-08",
        kind: "joined",
        uid: 10,
        name: "P10",
        other: { unionId: 8, tag: "CROW" },
      },
    ]);
  });

  it("serves no blocked roster key or value", async () => {
    const moves = await allianceMoves(db, 7, TODAY);
    expect(findBlockedKeys(moves)).toEqual([]);
    expect(JSON.stringify(moves)).not.toMatch(/1793000000|"(x|y|online)"/);
  });

  it("is null, which the shared cache never keeps, for an alliance with no roster in the window", async () => {
    expect(await allianceMoves(db, 999, TODAY)).toBeNull();
    // Its newest roster is older than the 30 days.
    expect(await allianceMoves(db, 7, "2026-12-31")).toBeNull();
  });

  it("has nothing to compare for an alliance with one roster in the window", async () => {
    expect(await allianceMoves(db, 8, "2026-11-06")).toMatchObject({ compared: false, moves: [] });
  });
});
