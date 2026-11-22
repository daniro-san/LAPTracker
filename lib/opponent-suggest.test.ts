// D155: the KvK opponent's tags suggested from its server's ranks board. PGlite and a stubbed internal
// source, no network. Invented alliances of an invented server 326.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { T0 } from "./collector.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { suggestTags } from "./opponent-suggest";
import { claimSuggestion, saveOpponent, SUGGEST_STALE_AFTER_MS } from "./repo/kvk";
import { events, snapshots } from "./schema";
import { kvkOpponents, kvkReads, kvkSuggestions } from "./schema-kvk";
import { fetchRanks } from "./sources/internal";
import { mockFetch, readFixture, respond, stubSourceEnv } from "./sources/test-helpers";
import { type RanksBoard, UpstreamError } from "./sources/types";

const WAR = new Date("2026-11-28T14:00:00Z"); // Sat 12:00 ST, the KvK
const NOW = new Date("2026-11-26T18:00:00Z"); // Thu 16:00 ST
const SERVER = 326;

/** 20 invented alliances of server 326, the first the mightiest. */
const IDS = Array.from({ length: 20 }, (_, i) => 70_000_001 + i);
const board = (over: Partial<RanksBoard> = {}): RanksBoard => ({
  server: SERVER,
  pulledAt: new Date("2026-11-26T17:30:00Z"),
  power: new Map(IDS.map((id, i) => [id, 9_000_000_000 - i * 100_000_000])),
  kills: new Map(IDS.map((id) => [id, 50_000_000])),
  labels: new Map(IDS.map((id, i) => [id, { tag: `Z${i}`, name: `Zephyr ${i}`, badgeId: 105 }])),
  ...over,
});

/** A stand-in for the internal source that counts its calls and answers `answer`. */
function stub(answer: (server: number) => RanksBoard | Error) {
  const calls: number[] = [];
  return {
    calls,
    internal: {
      fetchRanks: async (server: number) => {
        calls.push(server);
        const a = answer(server);
        if (a instanceof Error) throw a;
        return a;
      },
    },
  };
}

const rows = (db: Db) => db.select().from(kvkSuggestions);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveOpponent(db, { eventAt: WAR, server: SERVER, tags: [] }, T0);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("suggestTags (D155)", () => {
  it("reads the opponent's board once per (KvK, server): a second save or press makes no call", async () => {
    const s = stub((server) => board({ server }));
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("read");
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("kept");
    expect(await suggestTags(s, db, WAR, NOW, true)).toBe("kept");
    expect(s.calls).toEqual([SERVER]);
    await saveOpponent(db, { eventAt: WAR, server: 327, tags: [] }, NOW);
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("read");
    expect(s.calls).toEqual([SERVER, 327]);
  });

  it("makes one call when two saves of the same server claim it at once", async () => {
    const s = stub((server) => board({ server }));
    const outcomes = await Promise.all([
      suggestTags(s, db, WAR, NOW, false),
      suggestTags(s, db, WAR, NOW, false),
    ]);
    expect(outcomes.sort()).toEqual(["kept", "read"]);
    expect(s.calls).toEqual([SERVER]);
  });

  it("claims a running read again on the press only once it is more than 2 minutes old", async () => {
    // A claim whose request died before its answer: still running.
    expect(await claimSuggestion(db, { eventAt: WAR, server: SERVER }, NOW, false)).toBe(true);
    const s = stub((server) => board({ server }));
    const after = (ms: number) => new Date(NOW.getTime() + ms);
    expect(await suggestTags(s, db, WAR, after(SUGGEST_STALE_AFTER_MS), true)).toBe("kept");
    expect(s.calls).toEqual([]);
    expect(await suggestTags(s, db, WAR, after(SUGGEST_STALE_AFTER_MS + 1000), true)).toBe("read");
    expect(s.calls).toEqual([SERVER]);
    expect(await rows(db)).toMatchObject([{ status: "read", attempts: 2 }]);
  });

  it("suggests the 15 alliances with the most might, skipping a tag the Start could not read", async () => {
    const labels = board().labels;
    labels.set(IDS[0] ?? 0, { tag: null, name: "No tag", badgeId: null });
    labels.set(IDS[1] ?? 0, { tag: "A B", name: "Spaced", badgeId: null });
    await suggestTags(
      stub(() => board({ labels })),
      db,
      WAR,
      NOW,
      false,
    );
    const [row] = await rows(db);
    expect(row?.status).toBe("read");
    // Z2..Z16: the two untaggable ones are skipped, the 17th–20th by might never appear.
    expect(row?.alliances?.map((a) => a.tag)).toEqual(
      Array.from({ length: 15 }, (_, i) => `Z${i + 2}`),
    );
    expect(row?.alliances?.[0]).toEqual({ tag: "Z2", name: "Zephyr 2", power: 8_800_000_000 });
  });

  it("stores a failed read, retried only by the press and at most 3 times in all", async () => {
    const s = stub(() => new UpstreamError(503));
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("failed");
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("kept");
    expect(await suggestTags(s, db, WAR, NOW, true)).toBe("failed");
    expect(await suggestTags(s, db, WAR, NOW, true)).toBe("failed");
    expect(await suggestTags(s, db, WAR, NOW, true)).toBe("kept");
    expect(s.calls).toHaveLength(3);
    expect(await rows(db)).toMatchObject([{ status: "failed", attempts: 3, alliances: null }]);
  });

  it("treats a board that says it is another server as a failed read", async () => {
    await suggestTags(
      stub(() => board({ server: 325 })),
      db,
      WAR,
      NOW,
      false,
    );
    expect(await rows(db)).toMatchObject([{ status: "failed", alliances: null }]);
  });

  it("treats a board that does not say its server as a failed read", async () => {
    const s = stub(() => board({ server: null }));
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("failed");
    expect(await rows(db)).toMatchObject([{ status: "failed", alliances: null }]);
  });

  it("makes no call once the war has started or the Start has read a tag", async () => {
    const s = stub(() => board());
    expect(await suggestTags(s, db, WAR, WAR, true)).toBe("war_started");
    // The Start's error row for one tag: the opponent was read, so nothing more changes.
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
    expect(await suggestTags(s, db, WAR, NOW, true)).toBe("opponent_read");
    expect(await suggestTags(s, db, WAR, NOW, false)).toBe("opponent_read");
    expect(s.calls).toEqual([]);
    expect(await rows(db)).toEqual([]);
  });

  it("stores only each alliance's tag, name and might, never a player's row of the board", async () => {
    stubSourceEnv();
    const body = readFixture("ranks-325-20261104T201831Z/ranks.json").replace(
      '"sid":325',
      `"sid":${SERVER}`,
    );
    mockFetch(respond(body));
    expect(await suggestTags({ internal: { fetchRanks } }, db, WAR, NOW, false)).toBe("read");
    const [row] = await rows(db);
    for (const a of row?.alliances ?? [])
      expect(Object.keys(a).sort()).toEqual(["name", "power", "tag"]);
    const players = (
      JSON.parse(body) as { boards: { slug: string; rows: { id: number }[] }[] }
    ).boards
      .filter((b) => !b.slug.startsWith("alliance_"))
      .flatMap((b) => b.rows.map((r) => String(r.id)));
    expect(players.length).toBeGreaterThan(0);
    const stored = JSON.stringify(row);
    expect(stored).not.toMatch(/avatar|badge|https?:/);
    for (const uid of players) expect(stored).not.toContain(uid);
  });
});
