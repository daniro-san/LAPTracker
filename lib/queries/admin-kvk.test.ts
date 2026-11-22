// /admin's KvK opponent card (D155): when "Suggest tags" may read the opponent's ranks board. PGlite, invented
// server 326.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { saveOpponent, SUGGEST_STALE_AFTER_MS } from "../repo/kvk";
import { events, snapshots } from "../schema";
import { kvkOpponents, kvkReads, kvkSuggestions } from "../schema-kvk";
import { adminKvk } from "./admin-kvk";

const WAR = new Date("2026-11-28T14:00:00Z"); // Sat 12:00 ST, the next KvK
const NOW = new Date("2026-11-26T18:00:00Z"); // Thu 16:00 ST

/** The card's canSuggest for the next KvK at `now`. */
const canSuggest = async (now = NOW) => (await adminKvk(db, WAR, now))[0]?.canSuggest;

/** The (KvK, server 326) board read as stored, in place of a real read. */
const stored = (status: "running" | "read" | "failed", attempts: number, claimedAt = NOW) =>
  db.insert(kvkSuggestions).values({ eventAt: WAR, server: 326, status, attempts, claimedAt });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("adminKvk canSuggest (D155)", () => {
  it("offers Suggest tags with no read yet, and after a failed read only while attempts remain", async () => {
    expect(await canSuggest()).toBe(false); // no server saved
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: [] }, NOW);
    expect(await canSuggest()).toBe(true);
    await stored("failed", 2);
    expect(await canSuggest()).toBe(true);
    await db.update(kvkSuggestions).set({ attempts: 3 });
    expect(await canSuggest()).toBe(false);
  });

  it("never offers it again after a read", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: [] }, NOW);
    await stored("read", 1);
    expect(await canSuggest()).toBe(false);
  });

  it("offers it for a running read only once its claim is more than 2 minutes old", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: [] }, NOW);
    await stored("running", 1);
    expect(await canSuggest(new Date(NOW.getTime() + SUGGEST_STALE_AFTER_MS))).toBe(false);
    expect(await canSuggest(new Date(NOW.getTime() + SUGGEST_STALE_AFTER_MS + 1000))).toBe(true);
  });

  it("offers none at the war or once the Start read a tag", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["Z0"] }, NOW);
    expect(await canSuggest(WAR)).toBe(false);
    const [event] = await db
      .insert(events)
      .values({
        name: "Saturday Event",
        eventAtUtc: WAR,
        allianceIds: [],
        beforeAt: NOW,
        afterAt: WAR,
      })
      .returning({ id: events.id });
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase: "before", startedAt: NOW, status: "complete" })
      .returning({ id: snapshots.id });
    const [o] = await db.select({ id: kvkOpponents.id }).from(kvkOpponents);
    await db.insert(kvkReads).values({
      opponentId: o?.id ?? 0,
      snapshotId: snap?.id ?? 0,
      phase: "before",
      tag: "Z0",
      isFresh: false,
      error: "not found",
      readAt: NOW,
    });
    expect(await canSuggest()).toBe(false);
  });
});
