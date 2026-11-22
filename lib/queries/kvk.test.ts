// The KvK matchup read model and the opponent's save rules (D152), on PGlite. Invented alliances of our server
// and of an invented server 326. The war is Saturday 12:00 ST (14:00 UTC).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { insertOpponentRead, opponentFor, saveOpponent, type OpponentRead } from "../repo/kvk";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { eventMatchup } from "./kvk";

const WAR = new Date("2026-11-28T14:00:00Z"); // Sat 12:00 ST
const START = new Date("2026-11-28T12:03:00Z"); // Sat 10:03 ST
const END = new Date("2026-11-28T16:02:00Z"); // Sat 14:02 ST
const M = 1_000_000;
type Members = [number, number][];
/** Our two alliances at the Start, and two of theirs: `[might, kills]` per member. */
const OUR_START: { unionId: number; members: Members }[] = [
  {
    unionId: 1,
    members: [
      [70 * M, 5 * M],
      [50 * M, 1 * M],
    ],
  },
  {
    unionId: 2,
    members: [
      [40 * M, 2 * M],
      [30 * M, 1 * M],
    ],
  },
];
const THEIR_A: Members = [
  [65 * M, 9 * M],
  [61 * M, 8 * M],
];
const THEIR_B: Members = [
  [20 * M, 3 * M],
  [20 * M, 1 * M],
];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** The scheduled event with our Start (and End): each alliance has two members, `[might, kills]` each. */
async function seedEvent(
  phases: Partial<Record<"before" | "after", { unionId: number; members: [number, number][] }[]>>,
  extra: Partial<typeof events.$inferInsert> = {},
) {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-28",
      eventAtUtc: WAR,
      allianceIds: [],
      beforeAt: START,
      afterAt: END,
      ...extra,
    })
    .returning({ id: events.id });
  const eventId = event?.id ?? 0;
  for (const [phase, rows] of Object.entries(phases)) {
    const at = phase === "before" ? START : END;
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId, phase: phase as "before" | "after", startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    for (const r of rows ?? []) {
      const [row] = await db
        .insert(allianceSnapshots)
        .values({
          snapshotId: snap?.id ?? 0,
          unionId: r.unionId,
          tag: `U${r.unionId}`,
          name: `Ours ${r.unionId}`,
          source: "v1",
          isFresh: true,
          sourceUpdatedAt: at,
          totalPower: r.members.reduce((t, [m]) => t + m, 0),
          totalKills: r.members.reduce((t, [, k]) => t + k, 0),
          rawJson: { members: [{ uid: 1, x: 1, y: 2, online: true, joined_at: 1 }] },
        })
        .returning({ id: allianceSnapshots.id });
      await db.insert(memberSnapshots).values(
        r.members.map(([power, kills], i) => ({
          allianceSnapshotId: row?.id ?? 0,
          uid: r.unionId * 10 + i,
          name: `ours-member-${i}`,
          power,
          kills,
        })),
      );
    }
  }
  return eventId;
}

/** One opponent row: two members `[might, kills]`. */
const theirs = (
  opponentId: number,
  snapshotId: number,
  phase: "before" | "after",
  tag: string,
  members: [number, number][],
  extra: Partial<OpponentRead> = {},
): OpponentRead => ({
  opponentId,
  snapshotId,
  phase,
  tag,
  unionId: 70_000 + tag.charCodeAt(0),
  sid: 326,
  name: `Theirs ${tag}`,
  memberCount: members.length,
  totalPower: members.reduce((t, [m]) => t + m, 0),
  totalKills: members.reduce((t, [, k]) => t + k, 0),
  memberUids: members.map((_, i) => 9_000 + tag.charCodeAt(0) * 10 + i),
  memberPower: members.map(([m]) => m),
  memberKills: members.map(([, k]) => k),
  sourceUpdatedAt: phase === "before" ? START : END,
  cached: false,
  isFresh: true,
  error: null,
  readAt: phase === "before" ? START : END,
  ...extra,
});

async function opponentWith(eventId: number) {
  expect(
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["A", "B", "C"] }, START),
  ).toBeNull();
  const o = await opponentFor(db, eventId);
  const [snap] = await db.select({ id: snapshots.id, phase: snapshots.phase }).from(snapshots);
  return { id: o?.id ?? 0, snapshotId: snap?.id ?? 0 };
}

describe("eventMatchup (D152)", () => {
  it("compares our top n with theirs at the Start, n the smaller count of usable readings", async () => {
    const eventId = await seedEvent({
      before: [
        {
          unionId: 1,
          members: [
            [70 * M, 5 * M],
            [50 * M, 1 * M],
          ],
        },
        {
          unionId: 2,
          members: [
            [40 * M, 2 * M],
            [30 * M, 1 * M],
          ],
        },
        {
          unionId: 3,
          members: [
            [10 * M, 1 * M],
            [10 * M, 0],
          ],
        },
      ],
    });
    const o = await opponentWith(eventId);
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "A", THEIR_A));
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "B", THEIR_B));
    await insertOpponentRead(
      db,
      theirs(o.id, o.snapshotId, "before", "C", [], { error: "not found", unionId: null }),
    );

    const m = await eventMatchup(db, eventId);

    expect(m).toMatchObject({ server: 326, tags: 3, read: 2, ended: false });
    expect(m?.matchup.n).toBe(2);
    expect(m?.matchup.us).toMatchObject({
      might: 190 * M,
      kills: 9 * M,
      heavy: 1,
      members: 4,
      change: null,
    });
    expect(m?.matchup.us.alliances.map((a) => a.unionId)).toEqual([1, 2]);
    expect(m?.matchup.them).toMatchObject({ might: 166 * M, kills: 21 * M, heavy: 2, members: 4 });
  });

  it("shows Start to End over the members in both readings, and no change for a stale End", async () => {
    const eventId = await seedEvent({
      before: OUR_START,
      after: [
        {
          unionId: 1,
          members: [
            [60 * M, 6 * M],
            [45 * M, 3 * M],
          ],
        },
        {
          unionId: 2,
          members: [
            [39 * M, 2 * M],
            [30 * M, 1 * M],
          ],
        },
      ],
    });
    const o = await opponentWith(eventId);
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "A", THEIR_A));
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "B", THEIR_B));
    await insertOpponentRead(
      db,
      theirs(o.id, o.snapshotId, "after", "A", [
        [50 * M, 10 * M],
        [61 * M, 8 * M],
      ]),
    );
    await insertOpponentRead(
      db,
      theirs(
        o.id,
        o.snapshotId,
        "after",
        "B",
        [
          [1, 1],
          [1, 1],
        ],
        { isFresh: false },
      ),
    );

    const m = await eventMatchup(db, eventId);

    expect(m?.ended).toBe(true);
    expect(m?.matchup.us.change).toEqual({ counted: 2, might: -16 * M, kills: 3 * M, members: 4 });
    expect(m?.matchup.them.change).toEqual({
      counted: 1,
      might: -15 * M,
      kills: 1 * M,
      members: 2,
    });
    expect(m?.matchup.them.alliances.find((a) => a.tag === "B")?.change).toBeNull();
  });

  it("returns alliance-level figures only: no member name, uid or blocked roster key", async () => {
    const eventId = await seedEvent({
      before: [
        {
          unionId: 1,
          members: [
            [70 * M, 5 * M],
            [50 * M, 1 * M],
          ],
        },
      ],
    });
    const o = await opponentWith(eventId);
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "A", THEIR_A));
    const body = JSON.stringify(await eventMatchup(db, eventId));
    expect(body).toContain("Theirs A");
    expect(findBlockedKeys(JSON.parse(body))).toEqual([]);
    // The opponent members are uids 9650 and 9651.
    expect(body).not.toMatch(/ours-member|memberUids|memberPower|"uid"|\D965[01]\D/);
  });

  it("gives a rehearsal or a manual round no opponent, even at the opponent's war time", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["A"] }, START);
    const rehearsal = await seedEvent({}, { isTest: true });
    expect(await opponentFor(db, rehearsal)).toBeNull();
  });
});

describe("saveOpponent (D152)", () => {
  it("refuses a new server once its Start read a tag, keeps the tags editable before the war, refuses at the war", async () => {
    const eventId = await seedEvent({ before: [] });
    const o = await opponentWith(eventId);
    await insertOpponentRead(db, theirs(o.id, o.snapshotId, "before", "A", [[1, 1]]));
    expect(await saveOpponent(db, { eventAt: WAR, server: 327, tags: ["A"] }, START)).toBe(
      "opponent_read",
    );
    expect(
      await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["A", "D"] }, START),
    ).toBeNull();
    expect((await opponentFor(db, eventId))?.tags).toEqual(["A", "D"]);
    expect(await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["E"] }, WAR)).toBe(
      "war_started",
    );
  });

  it("refuses a change while the event's Start is running", async () => {
    const eventId = await seedEvent({});
    await db
      .insert(snapshots)
      .values({ eventId, phase: "before", startedAt: START, status: "running" });
    expect(await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["A"] }, START)).toBe(
      "snapshot_running",
    );
  });
});
