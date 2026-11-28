// player_reads and player_history (D132) against PGlite: overlapping reads add each history row once, per
// alliance, and the daily clean-up clears raw bodies past 90 days while their columns stay. The recruit check's
// name search reads 90 days only, and the download leaves a non-member's shield and map times empty.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { appErrorDetail } from "../report-error";
import { playerHistory, playerReads } from "../schema-squads";
import type { HistoryInput } from "../sources/types";
import { playerAnswer } from "../squads.test-helpers";
import { seedRoster } from "../workspace-data.test-helpers";
import { clearOldPlayerRaw, gameLanguages, storePlayerRead, trailNames } from "./player-reads";
import { workspaceDumps } from "./workspace-data";

const NOW = new Date("2026-11-20T02:00:00Z");
const DAY = 86_400_000;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

const row = (hoursAgo: number): HistoryInput => ({
  t: new Date(NOW.getTime() - hoursAgo * 3_600_000),
  power: 1_000 - hoursAgo,
  kills: 5,
  level: 29,
  vip: null,
  unionId: 900001,
  unionAbbr: "INV",
  sid: 325,
  changeFlags: "might",
  nick: "Invented",
});

describe("player reads (D132)", () => {
  it("gives the newest game language of the members asked for, within the window only (D140)", async () => {
    const at = (days: number) => new Date(NOW.getTime() - days * DAY);
    await db.insert(playerReads).values([
      { unionId: 900001, uid: 7, readAt: at(3), language: "pt" },
      { unionId: 900001, uid: 7, readAt: at(1), language: "fr" },
      { unionId: 900001, uid: 7, readAt: at(0), language: null },
      // Older than the window, a member not asked for, and another workspace's read.
      { unionId: 900001, uid: 8, readAt: at(30), language: "pt" },
      { unionId: 900001, uid: 9, readAt: at(1), language: "en" },
      { unionId: 900002, uid: 7, readAt: NOW, language: "en" },
    ]);
    expect(await gameLanguages(db, 900001, [7, 8], at(14))).toEqual(new Map([[7, "fr"]]));
    expect(await gameLanguages(db, 900001, [], at(14))).toEqual(new Map());
  });

  it("adds each history row once per alliance and member, however the reads overlap", async () => {
    const read = (hours: number[]) => playerAnswer(7, [], null, { history: hours.map(row) });
    expect(await storePlayerRead(db, 900001, read([12, 8, 4]), NOW)).toBe(3);
    expect(await storePlayerRead(db, 900001, read([8, 4, 0]), NOW)).toBe(1);
    // Another workspace's alliance reading the same player keeps its own rows.
    expect(await storePlayerRead(db, 900002, read([4]), NOW)).toBe(1);
    expect(await db.select().from(playerHistory)).toHaveLength(5);
    expect(await db.select().from(playerReads)).toHaveLength(3);
  });

  it("lets a failed write carry its class and code only, never a field of the body (D71)", async () => {
    const raw = {
      uid: 7,
      x: 98765,
      y: 54321,
      online: true,
      avatar_url: "https://avatar.example.test",
    };
    // A sid out of the integer range makes the insert fail inside Postgres.
    const facts = { ...playerAnswer(7).facts, sid: 1e12 };
    const error = await storePlayerRead(db, 900001, playerAnswer(7, [], null, { raw, facts }), NOW)
      .then(() => null)
      .catch((e: unknown) => e as Error);
    expect(error?.message).toBe("player_reads.write_failed Error 22003");
    expect(error?.cause).toBeUndefined();
    // What app_errors and console.error would keep of it.
    const kept = JSON.stringify(appErrorDetail(error, []));
    for (const marker of ["98765", "54321", "avatar", "online"]) expect(kept).not.toContain(marker);
  });

  it("clears raw bodies older than 90 days and keeps their columns", async () => {
    const answer = playerAnswer(7, [], null, {
      raw: { uid: 7, nick: "Invented" },
      facts: { ...playerAnswer(7).facts, shielding: 1 },
    });
    await storePlayerRead(db, 900001, answer, new Date(NOW.getTime() - 91 * DAY));
    await storePlayerRead(db, 900001, answer, new Date(NOW.getTime() - 89 * DAY));
    expect(await clearOldPlayerRaw(db, NOW)).toBe(1);
    const rows = await db.select().from(playerReads).orderBy(playerReads.readAt);
    expect(rows.map((r) => [r.rawJson, r.shielding])).toEqual([
      [null, 1],
      [{ uid: 7, nick: "Invented" }, 1],
    ]);
  });

  it("finds history names of the last 90 days only (D149, issue 833)", async () => {
    const named = (uid: number, daysAgo: number, nick: string) => ({
      unionId: 900001,
      uid,
      t: new Date(NOW.getTime() - daysAgo * DAY),
      nick,
    });
    await db
      .insert(playerHistory)
      .values([named(7, 2, "Wren Recent"), named(8, 91, "Wren Old"), named(9, 1, "Other")]);
    expect(await trailNames(db, 900001, "wren", 10, NOW)).toEqual([
      { uid: 7, name: "Wren Recent" },
    ]);
  });

  it("downloads shield and map times only for players the alliance's rosters listed (D163, issue 833)", async () => {
    // The roster of 900001 lists uid 101; uid 202 is a recruit the recruit check read.
    await seedRoster(db, 900001);
    const read = (uid: number) => ({
      unionId: 900001,
      uid,
      readAt: NOW,
      shielding: 1,
      shieldType: 2,
      mapUpdatedAt: NOW,
      power: 5_000,
    });
    await db.insert(playerReads).values([read(101), read(202)]);
    const dumps = await workspaceDumps(db, { id: 0, unionId: 900001 });
    const dump = dumps.find((d) => d.file === "player-reads");
    const rows = (dump?.rows ?? []).map((r) => Object.fromEntries(zip(dump?.columns ?? [], r)));
    expect(rows.map((r) => [r.uid, r.shielding, r.shield_type, r.map_updated_at, r.power])).toEqual(
      [
        [101, 1, 2, NOW, 5_000],
        [202, null, null, null, 5_000],
      ],
    );
    expect(dump?.columns).not.toContain("last_seen_at");
  });
});

const zip = (keys: string[], values: unknown[]) => keys.map((k, i) => [k, values[i]] as const);
