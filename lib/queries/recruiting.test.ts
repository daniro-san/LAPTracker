import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { trimRaw } from "../raw-json";
import { dailyRosters } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { recruitingAlliances } from "./recruiting";

/** An upstream /v1/alliances body as the daily read stores it, members and their private fields included. */
const body = (memberCount: number, join: Record<string, unknown>) =>
  trimRaw({
    member_count: memberCount,
    capacity: 100,
    leader_id: 999,
    join,
    members: [{ uid: 1, nick_name: "Pip", x: 1, y: 2, online: true, daily_tech: 5, active: 3 }],
  });

async function daily(db: Db, day: string, unionId: number, raw: unknown) {
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: `T${unionId}`,
    name: `Alliance ${unionId}`,
    isFresh: true,
    memberUids: [],
    memberNames: [],
    memberPower: [],
    memberKills: [],
    rawJson: raw,
  });
}

const TODAY = "2026-11-27";
let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  // 1: full yesterday, 27 spots free today (the newest read counts).
  await daily(db, "2026-11-26", 1, body(100, { auto: false }));
  await daily(db, TODAY, 1, body(73, { auto: true, power: 0, castle_level: 15 }));
  // 2: 3 spots free, two days ago (still shown).
  await daily(db, "2026-11-25", 2, body(97, { auto: false, power: 8_000_000, castle_level: 14 }));
  // 3: full. 4: 50 spots free, but three days ago.
  await daily(db, TODAY, 3, body(100, { auto: true }));
  await daily(db, "2026-11-24", 4, body(50, { auto: true }));
});

describe("recruitingAlliances", () => {
  it("computes spots free from the newest read, leaves out full alliances, most spots first", async () => {
    const rows = await recruitingAlliances(db, TODAY);
    expect(rows.map((r) => [r.unionId, r.spotsFree])).toEqual([
      [1, 27],
      [2, 3],
    ]);
    expect(rows[0]).toMatchObject({ day: TODAY, open: true, minMight: null, minHq: 15, tag: "T1" });
    expect(rows[1]).toMatchObject({ day: "2026-11-25", minMight: 8_000_000, minHq: 14 });
  });

  it("hides reads older than two days", async () => {
    expect((await recruitingAlliances(db, TODAY)).some((r) => r.unionId === 4)).toBe(false);
    expect((await recruitingAlliances(db, "2026-11-26")).map((r) => r.unionId)).toContain(4);
  });

  it("serves no blocked roster key and no member", async () => {
    const rows = await recruitingAlliances(db, TODAY);
    expect(findBlockedKeys(rows)).toEqual([]);
    expect(JSON.stringify(rows)).not.toContain("Pip");
  });
});
