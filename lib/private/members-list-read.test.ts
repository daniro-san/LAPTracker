// The Members list page's own read (issue 337): kills from the end-of-day read, and the photos, frames and
// past names that only the list page reads (the card route never does). Invented names and values.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  playerFrames,
  snapshots,
} from "../schema";
import { requireWorkspace } from "./access";
import { membersView, withListExtras } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const PHOTO = "https://phs-image.globallap.com/a.png";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
});

async function signedIn() {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "officer", "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** An event Start roster where member 1 was called Bramble and had a photo. */
async function eventRow() {
  const at = new Date("2026-11-07T14:00:00Z");
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [OGS], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({ eventId: event?.id ?? 0, phase: "before", startedAt: at, status: "complete" })
    .returning({ id: snapshots.id });
  const [row] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId: snap?.id ?? 0,
      unionId: OGS,
      source: "v1",
      isFresh: true,
      sourceUpdatedAt: at,
    })
    .returning({ id: allianceSnapshots.id });
  await db.insert(memberSnapshots).values({
    allianceSnapshotId: row?.id ?? 0,
    uid: 1,
    name: "Bramble",
    power: 1000,
    avatarUrl: PHOTO,
  });
}

/** One end-of-day read: member 1 (no kills sent) and member 2 (kills 4,200). */
async function endOfDay() {
  const at = new Date("2026-11-15T23:37:00-02:00");
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: at, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: OGS,
    memberCount: 2,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: [1, 2],
    memberNames: ["Quillon", "Kettle"],
    memberPower: [2000, 1000],
    memberKills: [0, 4200],
    rawJson: {
      members: [
        { uid: 1, nick_name: "Quillon", power: 2000, rank_code: 103 },
        { uid: 2, nick_name: "Kettle", power: 1000, rank_code: 103, kills: 4200 },
      ],
    },
  });
}

describe("the Members list page's read", () => {
  it("keeps kills the read did not send as null, never 0", async () => {
    await endOfDay();

    const view = await membersView(db, await signedIn(), NOW, "Etc/GMT+2");

    expect(view.members.map((m) => [m.uid, m.kills])).toEqual([
      [1, null],
      [2, 4200],
    ]);
  });

  it("adds each member's photo, frame and past names, which the Members view itself never holds", async () => {
    await eventRow();
    await db.insert(playerFrames).values({ uid: 1, frameId: 5010, seenAt: NOW });
    await endOfDay();
    const access = await signedIn();

    const view = await membersView(db, access, NOW, "Etc/GMT+2");
    const rows = await withListExtras(db, access, view.members);

    expect(rows.map((m) => [m.uid, m.photo, m.pastNames])).toEqual([
      [1, { hasAvatar: true, frameId: 5010 }, ["Bramble"]],
      [2, { hasAvatar: false, frameId: null }, []],
    ]);
    expect(JSON.stringify(view)).not.toMatch(/photo|avatar|frame/i);
  });
});
