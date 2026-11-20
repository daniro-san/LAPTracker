// Raid prep (D137) against a real Postgres (PGlite): the tracker's hints on each row ("not seen yet" is a
// hint, an 8-hour shield seen at T ends by T+8h and may end before KvK, a shield lost overnight), "Accept
// the tracker's" writing only ✓ for those seen with a shield, and the squads-off-the-wall mark kept apart
// from the Shield mark.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { playerReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { acceptTracker, prepView } from "./raid-prep";
import { addCall, markOne, openOccasion } from "./roll-call";
import { callView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
/** Saturday 10:30 ST (UTC−2), after both reads. */
const NOW = new Date("2026-11-21T12:30:00Z");
const ZONE = "Etc/GMT+2";
const UIDS = [101, 102, 103, 104];
const at = (iso: string) => new Date(iso);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await db.insert(dailyReads).values({ day: "2026-11-20", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-20",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: UIDS,
    memberNames: UIDS.map((u) => `Bramble${u}`),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
  // Friday 23:31 ST: 101 and 102 seen with an 8-hour shield (map 22:32 ST), 103 not seen, 104 not read.
  const night = { unionId: OGS, readAt: at("2026-11-21T01:31:00Z"), shieldType: 0 };
  const map = at("2026-11-21T00:32:00Z");
  await db.insert(playerReads).values([
    { ...night, uid: 101, shielding: 1, mapUpdatedAt: map, language: "pt" },
    { ...night, uid: 102, shielding: 1, mapUpdatedAt: map },
    { ...night, uid: 103, shielding: 0, mapUpdatedAt: map },
  ]);
  // Saturday 10:04 ST: 102's shield ended overnight; 101 turned on a new one at 08:00.
  const morning = { unionId: OGS, readAt: at("2026-11-21T12:04:00Z"), shieldType: 0 };
  await db.insert(playerReads).values([
    { ...morning, uid: 101, shielding: 1, mapUpdatedAt: at("2026-11-21T10:10:00Z") },
    { ...morning, uid: 102, shielding: 0, mapUpdatedAt: at("2026-11-21T11:40:00Z") },
  ]);
});

async function signedIn(): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function raidPrep(access: WorkspaceAccess) {
  const { id } = await addCall(db, access, { kind: "shield", day: "2026-11-21" }, randomUUID());
  return { id };
}

describe("Raid prep (D137)", () => {
  it("shows each row's tracker hint: map time, 8-hour end, may end before KvK, lost overnight", async () => {
    const access = await signedIn();
    const occasion = await raidPrep(access);
    const opened = await openOccasion(db, access, occasion);
    const view = await prepView(db, access, opened as NonNullable<typeof opened>, {
      zone: ZONE,
      now: NOW,
    });
    expect(view.friday).toBe("2026-11-20");
    expect(view.night).toMatchObject({ read: 3, on: 2 });
    expect(view.morning).toMatchObject({ read: 2, on: 1 });
    expect(view.when).toBe("kvk");
    const row = (uid: number) => view.rows.get(uid);
    // Seen at 08:10 ST: ends by 16:10 ST, after KvK's 12:00 start.
    expect(row(101)?.tracker).toMatchObject({
      suggestion: "on",
      endsBy: at("2026-11-21T18:10:00Z").getTime(),
      mayEndBeforeKvk: false,
    });
    expect(row(101)?.language).toBe("pt-BR");
    expect(row(102)?.tracker).toMatchObject({
      suggestion: "not_seen",
      lost: {
        night: at("2026-11-21T00:32:00Z").getTime(),
        morning: at("2026-11-21T11:40:00Z").getTime(),
      },
    });
    // Not seen on Friday and not read on Saturday: still the night's hint, never a ✗.
    expect(row(103)?.tracker?.suggestion).toBe("not_seen");
    expect(row(104)?.tracker).toBeNull();
    // On Friday night, the 8-hour shield seen at 22:32 ST may end before KvK.
    const friday = await prepView(db, access, opened as NonNullable<typeof opened>, {
      zone: ZONE,
      now: at("2026-11-21T01:40:00Z"),
    });
    expect(friday.when).toBe("reset");
  });

  it("Accept the tracker's marks ✓ only those seen with a shield and not marked yet", async () => {
    const access = await signedIn();
    const occasion = await raidPrep(access);
    await markOne(db, access, { occasion, uid: 101, mark: "no", version: 0 }, NOW);
    // 104 is seen with a shield of another kind this morning.
    const seen = { unionId: OGS, uid: 104, readAt: at("2026-11-21T12:10:00Z"), shielding: 1 };
    await db.insert(playerReads).values({ ...seen, shieldType: 2, mapUpdatedAt: NOW });
    const done = await acceptTracker(
      db,
      access,
      { occasion, uids: UIDS },
      { now: NOW, zone: ZONE },
    );
    // 104 gets ✓; 101 was marked by an officer and keeps ✗; 102 and 103 are not seen: not set.
    expect(done).toMatchObject({ ok: true, mark: "yes", written: [{ uid: 104, version: 1 }] });
    const view = await callView(db, access, occasion, "en", ZONE);
    expect(view?.rows.map((r) => [r.uid, r.mark])).toEqual(
      expect.arrayContaining([
        [101, "no"],
        [102, null],
        [103, null],
        [104, "yes"],
      ]),
    );
  });

  it("keeps the squads-off-the-wall mark apart from the Shield mark", async () => {
    const access = await signedIn();
    const occasion = await raidPrep(access);
    const wall = await markOne(
      db,
      access,
      { occasion, uid: 103, mark: "yes", version: 0, part: "wall" },
      NOW,
    );
    expect(wall).toEqual({ ok: true, version: 1 });
    const view = await callView(db, access, occasion, "en", ZONE);
    expect(view?.tally).toMatchObject({ yes: 0, notSet: 4 });
    const opened = await openOccasion(db, access, occasion);
    const prep = await prepView(db, access, opened as NonNullable<typeof opened>, {
      zone: ZONE,
      now: NOW,
    });
    expect(prep.rows.get(103)?.wall).toEqual({ mark: "yes", version: 1 });
    // Only a Raid prep roll call has the second mark.
    const raid = await addCall(db, access, { kind: "raid", day: "2026-11-21" }, randomUUID());
    const refused = await markOne(
      db,
      access,
      { occasion: raid, uid: 103, mark: "yes", version: 0, part: "wall" },
      NOW,
    );
    expect(refused).toEqual({ ok: false, code: "invalid" });
  });
});
