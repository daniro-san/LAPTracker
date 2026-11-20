import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { trimRaw } from "../raw-json";
import { dailyReads, dailyRosters } from "../schema";
import { allianceStatement } from "./statement";

const TEXT = "Welcome, night owls!\nWar at 20:00 server time.\nRules: example.org/rules";

/** An upstream /v1/alliances body as the daily read stores it: trimmed, members included. */
const body = (extra: Record<string, unknown>) =>
  trimRaw({
    union_id: 1,
    member_count: 100,
    capacity: 100,
    language: "en",
    leader_id: 999,
    join: { auto: false, power: 8_000_000, castle_level: 14 },
    declaration: TEXT,
    bulletin: TEXT,
    members: [{ uid: 1, nick_name: "Pip", x: 1, y: 2, online: true }],
    ...extra,
  });

async function daily(db: Db, day: string, unionId: number, raw: unknown, error?: string) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: new Date(`${day}T23:37:00Z`), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    isFresh: !error,
    error: error ?? null,
    memberUids: [],
    memberNames: [],
    memberPower: [],
    memberKills: [],
    rawJson: raw,
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await daily(db, "2026-11-18", 1, body({}));
  // The newest read of alliance 1 failed: no response kept (D72).
  await daily(db, "2026-11-19", 1, null, "v1.http_502");
  await daily(db, "2026-11-19", 2, body({ declaration: "", bulletin: " ", language: "all" }));
});

describe("allianceStatement", () => {
  it("serves only the statement and joining fields, from the newest successful read when the newest failed", async () => {
    expect(await allianceStatement(db, 1)).toEqual({
      day: "2026-11-18",
      text: TEXT,
      lang: "en",
      open: false,
      minMight: 8_000_000,
      minHq: 14,
      members: 100,
      capacity: 100,
    });
  });

  it("gives no text and no lang when the read has no statement and the language is `all`", async () => {
    const s = await allianceStatement(db, 2);
    expect(s).toMatchObject({ day: "2026-11-19", text: null, lang: null });
  });

  it("is null for an alliance with no daily read", async () => {
    expect(await allianceStatement(db, 3)).toBeNull();
  });
});
