import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { memberHistory, memberHistoryIndex } from "./member-history";

type Member = [uid: number, name: string, power: number | null, kills: number | null];

const at = (day: string) => new Date(`${day}T08:01:00Z`);

async function daily(db: Db, day: string, unionId: number, members: Member[], isFresh = true) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: at(day), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: unionId === 1 ? "OGs" : "B",
    name: `Alliance ${unionId}`,
    memberCount: members.length,
    sourceUpdatedAt: at(day),
    isFresh,
    memberUids: members.map((m) => m[0]),
    memberNames: members.map((m) => m[1]),
    memberPower: members.map((m) => m[2]) as number[],
    memberKills: members.map((m) => m[3]) as number[],
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await daily(db, "2026-11-08", 1, [
    [1, "Ana", 10, 5],
    [2, "Bo", 20, null],
  ]);
  await daily(db, "2026-11-09", 1, [[9, "Stale", 1, 1]], false);
  await daily(db, "2026-11-10", 1, [
    [1, "Ana Prime", 12, 8],
    [3, "Cy", 5, 1],
  ]);
  await daily(db, "2026-11-10", 2, [[2, "Bo", 20, 0]]);
});

describe("memberHistory (D60)", () => {
  it("diffs each usable roster against the previous usable one by uid, skipping a stale one", async () => {
    const history = await memberHistory(db, 1);

    expect(history?.cards.map((c) => [c.at, c.since])).toEqual([
      [at("2026-11-10"), at("2026-11-08")],
      [at("2026-11-08"), null],
    ]);
    const [latest, first] = history?.cards ?? [];
    expect(latest?.joined.map((m) => m.name)).toEqual(["Cy"]);
    expect(latest?.left).toEqual([
      { uid: 2, name: "Bo", power: 20, kills: null, nowIn: { unionId: 2, tag: "B" } },
    ]);
    expect(latest?.renamed).toEqual([{ uid: 1, from: "Ana", to: "Ana Prime" }]);
    expect(latest?.changed).toEqual([
      { uid: 1, name: "Ana Prime", power: 12, kills: 8, powerChange: 2, killsChange: 3 },
    ]);
    expect(first?.joined).toEqual([]);
  });

  it("pages from `before` and is null for an alliance with no usable roster", async () => {
    const older = await memberHistory(db, 1, { before: at("2026-11-10"), limit: 1 });

    expect(older?.cards.map((c) => c.at)).toEqual([at("2026-11-08")]);
    expect(older?.older).toBeNull();
    expect(await memberHistory(db, 99)).toBeNull();
  });

  it("indexes the same cards, times and spans as the full history, without member lists", async () => {
    const [index, full] = await Promise.all([memberHistoryIndex(db, 1), memberHistory(db, 1)]);

    expect(index?.entries).toEqual(
      full?.cards.map(({ at, event, since }) => ({ at, event, since })),
    );
    expect(index?.tag).toBe("OGs");
    expect(await memberHistoryIndex(db, 99)).toBeNull();
  });
});
