// Insights → KvK's map (issue 791): dots in 3 bands of kills gained, each with its member's name (D163),
// near/mid/far only with a castle point and naming their members, each member's newest shield reading of
// that KvK's raid (issue 817), and a read that sees only the workspace's own alliance, its own castle point
// and its own shield readings, from the newest public event since the date with a fresh Start and End.
// Against a real Postgres (PGlite). Invented names and places only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { eventEndPlaces } from "../repo/workspace-rosters";
import { saveCastle } from "../repo/workspaces";
import { allianceSnapshots, events, memberSnapshots, snapshots, workspaces } from "../schema";
import { playerReads } from "../schema-squads";
import type { WorkspaceAccess } from "./access";
import { kvkMapOf, kvkMapView } from "./kvk-map";

const AT = new Date("2026-11-21T14:00:00Z");
const END_AT = new Date("2026-11-21T16:00:00Z");
const place = (x: number, y: number, before: number | null, after: number | null) => ({
  uid: x * 1000 + y,
  name: `Invented ${x}-${y}`,
  x,
  y,
  before,
  after,
});

describe("kvkMapOf", () => {
  it("puts each dot in a band of kills gained: none, up to the gainers' median, above it", () => {
    const map = kvkMapOf(
      {
        at: AT,
        endAt: END_AT,
        unplaced: 0,
        places: [
          place(1, 1, 50, 50),
          place(2, 2, 50, 60),
          place(3, 3, 50, 70),
          place(4, 4, 50, 80),
          place(5, 5, null, 80),
        ],
      },
      null,
    );
    expect(map.median).toBe(20);
    expect(map.dots.map((d) => [d.name, d.band])).toEqual([
      ["Invented 1-1", "none"],
      ["Invented 2-2", "fewer"],
      ["Invented 3-3", "fewer"],
      ["Invented 4-4", "more"],
      ["Invented 5-5", null],
    ]);
  });

  it("has near, mid and far rows only once a castle point is set", () => {
    const end = {
      at: AT,
      endAt: END_AT,
      unplaced: 0,
      places: [
        place(100, 100, 0, 5),
        place(103, 104, 0, 7),
        place(110, 100, 0, 0),
        place(100, 120, 0, 9),
        place(160, 100, 0, 1),
        place(100, 190, 0, 2),
        place(500, 500, null, 3),
      ],
    };
    expect(kvkMapOf(end, null).bands).toBeNull();
    expect(kvkMapOf(end, { x: 100, y: 100 }).bands).toEqual([
      {
        band: "near",
        from: 0,
        to: 5,
        members: 2,
        kills: 12,
        names: ["Invented 100-100", "Invented 103-104"],
      },
      {
        band: "mid",
        from: 10,
        to: 20,
        members: 2,
        kills: 9,
        names: ["Invented 100-120", "Invented 110-100"],
      },
      {
        band: "far",
        from: 60,
        to: 90,
        members: 2,
        kills: 3,
        names: ["Invented 100-190", "Invented 160-100"],
      },
    ]);
    expect(kvkMapOf({ ...end, places: end.places.slice(0, 2) }, { x: 1, y: 1 }).bands).toBeNull();
  });

  it("marks each member's shield: seen, not seen, or no reading, with the newest map scan as of", () => {
    const end = {
      at: AT,
      endAt: END_AT,
      unplaced: 0,
      places: [place(1, 1, 0, 1), place(2, 2, 0, 1), place(3, 3, 0, 1)],
    };
    const read = (uid: number, shielding: number | null, mapAt: string) => ({
      uid,
      shielding,
      shieldType: 0,
      mapAt: new Date(mapAt),
      readAt: new Date("2026-11-21T10:30:00Z"),
    });
    const map = kvkMapOf(end, null, [
      read(1001, 1, "2026-11-21T10:10:00Z"),
      read(2002, 0, "2026-11-21T10:20:00Z"),
      read(9009, 1, "2026-11-21T11:00:00Z"),
    ]);
    expect(map.dots.map((d) => d.shield)).toEqual(["on", "not_seen", "unknown"]);
    expect(map.shieldAt).toEqual(new Date("2026-11-21T10:20:00Z"));
    expect(kvkMapOf(end, null).shieldAt).toBeNull();
  });
});

describe("kvkMapView and eventEndPlaces", () => {
  const OURS = 900_001;
  const THEIRS = 900_002;
  let db: Db;
  const ids = { ours: 0, theirs: 0 };
  beforeAll(async () => {
    db = await openTestDb();
  });
  beforeEach(async () => {
    await truncateAll(db);
    const rows = await db
      .insert(workspaces)
      .values([
        { unionId: OURS, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] },
        { unionId: THEIRS, slug: "bravo", discordGuildId: "3", leaderRoleIds: ["4"] },
      ])
      .returning({ id: workspaces.id });
    ids.ours = rows[0]?.id ?? 0;
    ids.theirs = rows[1]?.id ?? 0;
    await kvk(AT);
  });

  /** A scheduled event at `at` with Start and End rows for both alliances; `phases` and `row` vary them. */
  async function kvk(
    at: Date,
    o: {
      phases?: readonly ("before" | "after")[];
      event?: Partial<typeof events.$inferInsert>;
      row?: Partial<typeof allianceSnapshots.$inferInsert>;
    } = {},
  ) {
    const [event] = await db
      .insert(events)
      .values({
        name: "Saturday Event",
        eventAtUtc: at,
        allianceIds: [OURS, THEIRS],
        beforeAt: new Date(at.getTime() - 2 * 3_600_000),
        afterAt: new Date(at.getTime() + 2 * 3_600_000),
        ...o.event,
      })
      .returning({ id: events.id });
    for (const phase of o.phases ?? (["before", "after"] as const)) {
      const [snap] = await db
        .insert(snapshots)
        .values({ eventId: event?.id ?? 0, phase, startedAt: at, status: "complete" })
        .returning({ id: snapshots.id });
      for (const [unionId, uids] of [
        [OURS, [1, 2]],
        [THEIRS, [7, 8, 9]],
      ] as const) {
        const [row] = await db
          .insert(allianceSnapshots)
          .values({
            snapshotId: snap?.id ?? 0,
            unionId,
            source: "v1",
            isFresh: true,
            rawJson: {
              members: uids.map((uid) => ({ uid, x: 400 + uid, y: 600 + uid, online: 1 })),
            },
            ...(phase === "after" ? o.row : {}),
          })
          .returning({ id: allianceSnapshots.id });
        await db.insert(memberSnapshots).values(
          uids.map((uid) => ({
            allianceSnapshotId: row?.id ?? 0,
            uid,
            name: `Invented ${uid}`,
            kills: phase === "before" ? 100 : 100 + uid,
          })),
        );
      }
    }
  }

  it("shows the own alliance's End places with names, its castle point and its shields only", async () => {
    await saveCastle(db, ids.theirs, { x: 9, y: 9 });
    const reading = (unionId: number, uid: number, readAt: string) => ({
      unionId,
      uid,
      readAt: new Date(readAt),
      shielding: 1,
      shieldType: 0,
      mapUpdatedAt: new Date(readAt),
    });
    await db.insert(playerReads).values([
      // Friday's night read of the raid before that KvK (ST is UTC here).
      reading(OURS, 1, "2026-11-20T23:40:00Z"),
      // After KvK started: not that raid's reading.
      reading(OURS, 2, "2026-11-21T12:30:00Z"),
      // Another alliance's reading of the same uid.
      reading(THEIRS, 2, "2026-11-21T10:30:00Z"),
    ]);
    const access = { workspaceId: ids.ours, unionId: OURS } as WorkspaceAccess;
    const map = await kvkMapView(db, access, new Date("2026-11-22T00:00:00Z"), "UTC");
    expect(map?.dots).toEqual([
      { name: "Invented 1", x: 401, y: 601, band: "fewer", shield: "on" },
      { name: "Invented 2", x: 402, y: 602, band: "more", shield: "unknown" },
    ]);
    expect(map?.shieldAt).toEqual(new Date("2026-11-20T23:40:00Z"));
    expect(map?.castle).toBeNull();
    expect(JSON.stringify(map)).not.toMatch(/Invented [789]/);
  });

  const NOW = new Date("2026-11-22T00:00:00Z");
  const SINCE = new Date("2026-11-01T00:00:00Z");
  const LATER = new Date("2026-11-21T20:00:00Z");

  it("skips a stale or failed End row, an admin event and one older than `since`", async () => {
    await kvk(LATER, { row: { isFresh: false } });
    await kvk(new Date("2026-11-21T21:00:00Z"), { row: { error: "upstream 500" } });
    await kvk(new Date("2026-11-21T22:00:00Z"), { event: { visibility: "admin" } });
    expect((await eventEndPlaces(db, OURS, SINCE))?.at).toEqual(AT);
    expect(await eventEndPlaces(db, OURS, new Date("2026-11-21T15:00:00Z"))).toBeNull();
  });

  it("falls back to an older event when the newest has no Start or no End", async () => {
    await kvk(LATER, { phases: ["before"] });
    await kvk(new Date("2026-11-21T21:00:00Z"), { phases: ["after"] });
    expect((await eventEndPlaces(db, OURS, SINCE))?.at).toEqual(AT);
    expect(await eventEndPlaces(db, OURS, new Date("2026-11-21T15:00:00Z"))).toBeNull();
    expect(
      (
        await kvkMapView(
          db,
          { workspaceId: ids.ours, unionId: OURS } as WorkspaceAccess,
          NOW,
          "UTC",
        )
      )?.at,
    ).toEqual(AT);
  });
});
