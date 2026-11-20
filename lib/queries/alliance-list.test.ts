import { beforeAll, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { claimTrackedSet, storeBoard } from "../repo/alliances";
import { allianceList, MORE_PER_PAGE } from "./alliance-list";

const DAY = "2026-11-19";
/** 50 invented alliances, the first one the mightiest. */
const ALL = Array.from({ length: 50 }, (_, i) => 67_130_001 + i);
const TOP = ALL.slice(0, 20);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await storeBoard(db, DAY, {
    pulledAt: T0,
    power: new Map(ALL.map((id, i) => [id, 9_000_000 - i * 1000])),
    kills: new Map(ALL.map((id) => [id, 500])),
    labels: new Map(ALL.map((id) => [id, { tag: `A${id % 100}`, name: null, badgeId: null }])),
  });
  await claimTrackedSet(db, { day: DAY, allianceIds: TOP, source: "board" }, T0);
});

describe("allianceList (D133)", () => {
  it("lists the tracked set first, then the rest by might, a page at a time", async () => {
    const first = await allianceList(db, 1);
    const last = await allianceList(db, 99);

    expect(first.tracked.map((a) => a.unionId)).toEqual(TOP);
    expect(first.more.map((a) => a.powerRank)).toEqual(
      Array.from({ length: MORE_PER_PAGE }, (_, i) => 21 + i),
    );
    expect([first.total, first.pages, last.page]).toEqual([50, 2, 2]);
    expect(last.more.map((a) => a.unionId)).toEqual(ALL.slice(20 + MORE_PER_PAGE));
  });
});
