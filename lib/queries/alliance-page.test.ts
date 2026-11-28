import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { trimRaw } from "../raw-json";
import { dailyRosters } from "../schema";
import { alliancePage } from "./alliance-page";
import { BLOCKED_ROSTER_KEYS, findBlockedKeys } from "./blocked-keys";

/** A roster member as /v1 sends it, private fields included. */
const member = (
  uid: number,
  power: number,
  rankCode: number,
  extra: Record<string, unknown> = {},
) => ({
  uid,
  nick_name: `P${uid}`,
  power,
  rank_code: rankCode,
  rank_label: `R${rankCode - 100}`,
  x: 11,
  y: 22,
  online: true,
  last_online_at: 1793807944,
  joined_at: 1793000000,
  avatar_url: "https://phs-image.globallap.com/a.jpg",
  active: 580,
  daily_honor: 1000,
  daily_tech: 4450,
  ...extra,
});

async function daily(db: Db, day: string, members: ReturnType<typeof member>[], power: number) {
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: 7,
    tag: "OGs",
    name: "OldGrandmas",
    memberCount: members.length + 1,
    totalPower: power,
    totalKills: 0,
    isFresh: true,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.nick_name),
    memberPower: members.map((m) => m.power),
    memberKills: members.map(() => 0),
    rawJson: trimRaw({ sid: 325, capacity: members.length, leader_id: 3, members }),
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  const today = [
    member(1, 50, 103),
    member(2, 90, 103, { daily_tech: null }),
    member(3, 10, 105),
    member(4, 70, 104),
  ];
  await daily(db, "2026-08-01", today, 1); // past the 90 days
  await daily(db, "2026-11-20", today, 200);
  await daily(db, "2026-11-27", today, 220);
});

describe("alliancePage", () => {
  it("gives the head's facts from the newest roster: server, leader, might, members of capacity", async () => {
    const page = await alliancePage(db, 7);
    expect(page).toMatchObject({ day: "2026-11-27", server: 325, might: 220, capacity: 4 });
    // memberCount says 5 of 4 (issue 481): never more than the capacity.
    expect(page?.members).toBe(4);
    expect(page?.leader).toEqual({ uid: 3, name: "P3", power: 10 });
  });

  it("sorts the members by rank, then by might", async () => {
    const page = await alliancePage(db, 7);
    expect(page?.roster.map((m) => m.uid)).toEqual([3, 4, 2, 1]);
  });

  it("keeps the public figures and leaves an unknown one null", async () => {
    const [, , two] = (await alliancePage(db, 7))?.roster ?? [];
    expect(two).toMatchObject({ uid: 2, rank: 3, active: 580, dailyHonor: 1000, dailyTech: null });
  });

  it("serves no blocked roster key or value", async () => {
    const page = await alliancePage(db, 7);
    expect(findBlockedKeys(page, { allowActivity: true })).toEqual([]);
    const text = JSON.stringify(page);
    for (const key of BLOCKED_ROSTER_KEYS) expect(text).not.toContain(`"${key}"`);
    expect(text).not.toContain("phs-image");
    expect(text).not.toContain("1793807944");
  });

  it("reads the growth of the last 90 days, oldest first, members capped at the capacity", async () => {
    const page = await alliancePage(db, 7);
    expect(page?.growth).toEqual([
      { day: "2026-11-20", might: 200, members: 4 },
      { day: "2026-11-27", might: 220, members: 4 },
    ]);
  });

  it("is null for an alliance with no roster", async () => {
    expect(await alliancePage(db, 8)).toBeNull();
  });
});
