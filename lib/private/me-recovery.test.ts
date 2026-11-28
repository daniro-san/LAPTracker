// A member's own page (D142): "Back to …% of your might before KvK" and "Thanks for the … kills you gained
// in KvK" count from the newest KvK, never from an Origin of Chaos (#806). PGlite, invented values only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import type { MeAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { meView } from "./me";

const OURS = 67111177;
const WREN = 101;
// Sunday 2026-12-06, 12:00 ST: the day after Origin of Chaos.
const NOW = new Date("2026-12-06T14:00:00Z");
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

/** A scheduled event at `at` whose Start read Wren with `power` and 1M kills, and its End `kills`. */
async function event(name: string, at: string, power: number, kills: number) {
  const [row] = await db
    .insert(events)
    .values({
      name,
      eventAtUtc: new Date(at),
      allianceIds: [OURS],
      beforeAt: new Date(at),
      afterAt: new Date(at),
    })
    .returning({ id: events.id });
  for (const [phase, wren] of [
    ["before", { power, kills: 1_000_000 }],
    ["after", { power, kills }],
  ] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: row?.id ?? 0, phase, startedAt: NOW, status: "complete" })
      .returning({ id: snapshots.id });
    const [alliance] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: snap?.id ?? 0, unionId: OURS, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db
      .insert(memberSnapshots)
      .values({ allianceSnapshotId: alliance?.id ?? 0, uid: WREN, name: "Wren", ...wren });
  }
}

/** Wren's "Your progress" at NOW, with one daily read on Sunday (might 900K). */
async function progress() {
  await db.insert(dailyReads).values({ day: "2026-12-06", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-12-06",
    unionId: OURS,
    memberCount: 1,
    isFresh: true,
    memberUids: [WREN],
    memberNames: ["Wren"],
    memberPower: [900_000],
    memberKills: [0],
    rawJson: { members: [{ uid: WREN }] },
  });
  const me = { workspaceId: 1, unionId: OURS, uid: WREN } as unknown as MeAccess;
  const view = await meView(db, me, {
    now: NOW,
    zone: "Etc/GMT+2",
    endRead: "14:00",
    language: "en",
    t,
  });
  return view.left ? null : view.progress;
}

describe("a member's KvK lines skip Origin of Chaos (#806)", () => {
  it("measures recovery against the KvK before an Origin of Chaos, not the Origin of Chaos", async () => {
    await event("Saturday Event 2026-11-28", "2026-11-28T14:00:00Z", 1_000_000, 1_000_000);
    await event("Origin of Chaos 2026-12-05", "2026-12-05T02:10:00Z", 2_000_000, 1_000_000);

    expect((await progress())?.kvk).toMatch(/^Back to 90% of your might before KvK \(.*28.*\)\.$/);
  });

  it("thanks for the KvK's kills when a newer Origin of Chaos also gained kills", async () => {
    await event("Saturday Event 2026-11-28", "2026-11-28T14:00:00Z", 1_000_000, 1_700_000);
    await event("Origin of Chaos 2026-12-05", "2026-12-05T02:10:00Z", 1_000_000, 1_300_000);

    expect((await progress())?.thanks).toMatch(
      /^Thanks for the 700K kills you gained in KvK \(.*28.*\)\.$/,
    );
  });
});
