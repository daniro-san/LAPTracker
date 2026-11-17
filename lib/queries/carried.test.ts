import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { whoCarried } from "./carried";
import { getEventDetail } from "./events";

interface Side {
  unionId: number;
  might: number;
  kills: number;
  fresh?: boolean;
}

let db: Db;
let day = 0;

/** One event with a Start and an End; the figures are alliance totals. Returns the event's id. */
async function seedEvent(before: Side[], after: Side[]): Promise<number> {
  const at = new Date(Date.UTC(2026, 9, 1 + day++, 14));
  const [event] = await db
    .insert(events)
    .values({ name: `Event ${day}`, eventAtUtc: at, allianceIds: [1], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  const eventId = (event as { id: number }).id;
  for (const [phase, rows] of [
    ["before", before],
    ["after", after],
  ] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    await db.insert(allianceSnapshots).values(
      rows.map((r) => ({
        snapshotId: (snap as { id: number }).id,
        unionId: r.unionId,
        tag: `T${r.unionId}`,
        source: "v1" as const,
        isFresh: r.fresh ?? true,
        totalPower: r.might,
        totalKills: r.kills,
        rawJson: { members: [{ uid: 1, x: 1, y: 2, online: true }] },
      })),
    );
  }
  return eventId;
}

/** Two alliances: 1 holds a quarter of the might and gains three quarters of the kills (ratio 3). */
const start = (extra: Side[] = []): Side[] => [
  { unionId: 1, might: 100, kills: 0 },
  { unionId: 2, might: 300, kills: 0 },
  ...extra,
];
const end = (extra: Side[] = []): Side[] => [
  { unionId: 1, might: 100, kills: 300 },
  { unionId: 2, might: 300, kills: 100 },
  ...extra,
];

async function carriedOf(eventId: number) {
  const detail = await getEventDetail(db, eventId);
  return whoCarried(db, detail as NonNullable<typeof detail>, null);
}

beforeEach(async () => {
  await truncateAll(db);
});

beforeAll(async () => {
  db = await openTestDb();
});

describe("whoCarried (#280)", () => {
  it("sets each alliance's share of the kills gained against its share of the might at Start", async () => {
    const carried = await carriedOf(await seedEvent(start(), end()));
    expect(carried?.rows[0]).toMatchObject({ unionId: 1, mightShare: 0.25, killShare: 0.75 });
    expect(carried?.rows.map((r) => r.unionId)).toEqual([1, 2]);
    expect(carried?.totals).toEqual({ alliances: 2, killsGained: 400, might: 400 });
    expect(findBlockedKeys(carried)).toEqual([]);
  });

  it("gives an alliance with a stale Start or End no figure and leaves it out of the totals", async () => {
    const carried = await carriedOf(
      await seedEvent(
        start([{ unionId: 3, might: 900, kills: 0 }]),
        end([{ unionId: 3, might: 900, kills: 5000, fresh: false }]),
      ),
    );
    expect(carried?.rows.map((r) => r.unionId)).toEqual([1, 2]);
    expect(carried?.totals.might).toBe(400);
  });

  it("is null until the event has an End", async () => {
    const detail = await getEventDetail(db, await seedEvent(start(), end()));
    const startOnly = {
      ...detail,
      snapshots: detail?.snapshots.filter((s) => s.phase === "before"),
    };
    expect(await whoCarried(db, startOnly as NonNullable<typeof detail>, null)).toBeNull();
  });

  it("shows the ratio with its range from the third event, and only the two shares before", async () => {
    // Alliance 1 has ratio 3 in the first two events, 1 in the third and 3 in the fourth.
    await seedEvent(start(), end());
    const second = await carriedOf(await seedEvent(start(), end()));
    expect(second?.rows.find((r) => r.unionId === 1)).toMatchObject({ spread: null });
    await seedEvent(start(), [
      { unionId: 1, might: 100, kills: 100 },
      { unionId: 2, might: 300, kills: 300 },
    ]);
    const third = await carriedOf(await seedEvent(start(), end()));
    expect(third?.rows.find((r) => r.unionId === 1)).toMatchObject({
      spread: { n: 4, low: 1, high: 3 },
    });
  });
});
