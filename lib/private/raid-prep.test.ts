// Raid prep (D137) against a real Postgres (PGlite): the tracker's hints on each row ("not seen yet" is a
// hint, a shield seen shows no length, a shield lost overnight), "Accept
// the tracker's" writing only ✓ for those seen with a shield, and the squads-off-the-wall mark kept apart
// from the Shield mark, the tick's marks still to check until "Checked" or a tap on the row, and the
// Discord summary's state (a past week's check shows only what it recorded).
import { randomUUID } from "node:crypto";

import { eq, gte } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { fillRaidPrep } from "../raid-prep-fill";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { rollCallMarks } from "../schema-rollcall";
import { playerReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { acceptTracker, checkTracker, prepView, summaryOf } from "./raid-prep";
import { addCall, markOne, openOccasion } from "./roll-call";
import { callRead, callView } from "./roll-call-view";
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
    // Both checkpoints, each at its map scan's time; a shield seen, never its length (D137, 2026-11-21).
    const night = at("2026-11-21T00:32:00Z").getTime();
    expect(row(101)?.tracker).toEqual({
      suggestion: "on",
      checkpoints: [
        { pass: "night", at: night, on: true },
        { pass: "morning", at: at("2026-11-21T10:10:00Z").getTime(), on: true },
      ],
    });
    expect(row(101)?.language).toBe("pt-BR");
    expect(row(102)?.tracker).toEqual({
      suggestion: "not_seen",
      checkpoints: [
        { pass: "night", at: night, on: true },
        { pass: "morning", at: at("2026-11-21T11:40:00Z").getTime(), on: false },
      ],
    });
    // Not seen on Friday and not read on Saturday: the night checkpoint only.
    expect(row(103)?.tracker).toEqual({
      suggestion: "not_seen",
      checkpoints: [{ pass: "night", at: night, on: false }],
    });
    expect(row(104)?.tracker).toBeNull();
    const friday = await prepView(db, access, opened as NonNullable<typeof opened>, {
      zone: ZONE,
      now: at("2026-11-21T01:40:00Z"),
    });
    expect(friday.when).toBe("reset");
  });

  it("names the members to check by hand only once the morning check has read (issue 826)", async () => {
    const access = await signedIn();
    const occasion = await raidPrep(access);
    const opened = await openOccasion(db, access, occasion);
    const clock = { zone: ZONE, now: NOW };
    const morning = await prepView(db, access, opened as NonNullable<typeof opened>, clock);
    expect(morning.handCheck).not.toBeNull();
    await db.delete(playerReads).where(gte(playerReads.readAt, at("2026-11-21T10:00:00Z")));
    const night = await prepView(db, access, opened as NonNullable<typeof opened>, clock);
    expect(night.night).toMatchObject({ read: 3, on: 2 });
    expect(night.morning).toBeNull();
    expect(night.handCheck).toBeNull();
    expect([...night.rows.values()].every((r) => r.hand === null)).toBe(true);
  });

  it("takes a member off To check by hand when the after-reset check's map saw a shield (issue 827)", async () => {
    const access = await signedIn();
    const occasion = await raidPrep(access);
    const opened = await openOccasion(db, access, occasion);
    const clock = { zone: ZONE, now: NOW };
    const before = await prepView(db, access, opened as NonNullable<typeof opened>, clock);
    expect(before.handCheck).toContain(104);
    // Saturday 02:31 ST: 104 read once, a shield on the map of 01:35 ST (after the reset).
    const map = at("2026-11-21T03:35:00Z");
    await db.insert(playerReads).values({
      unionId: OGS,
      uid: 104,
      readAt: at("2026-11-21T04:31:00Z"),
      shielding: 1,
      shieldType: 0,
      mapUpdatedAt: map,
    });
    const view = await prepView(db, access, opened as NonNullable<typeof opened>, clock);
    expect(view.rows.get(104)?.tracker?.checkpoints).toEqual([
      { pass: "reset", at: map.getTime(), on: true },
    ]);
    expect(view.rows.get(104)?.hand).toBeNull();
    expect(view.handCheck).not.toContain(104);
    // The night and morning counts never count it.
    expect(view.night).toMatchObject({ read: 3, on: 2 });
    expect(view.morning).toMatchObject({ read: 2, on: 1 });
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
    // Accept only applies the tracker's reading: its ✓ is the tracker's, so a later morning reading that
    // sees no shield on 104 still updates it, while the officer's tapped ✗ on 101 stays (D137, 2026-11-21).
    const later = { unionId: OGS, readAt: at("2026-11-21T12:40:00Z"), shielding: 0, shieldType: 0 };
    await db.insert(playerReads).values([
      { ...later, uid: 101 },
      { ...later, uid: 104 },
    ]);
    const scope = { workspaceId: access.workspaceId, unionId: OGS };
    const fill = { now: at("2026-11-21T12:45:00Z"), zone: ZONE };
    expect(await fillRaidPrep(db, scope, "2026-11-20", fill)).toBe(2);
    const shield = await db.select().from(rollCallMarks).where(eq(rollCallMarks.part, "main"));
    const of = (uid: number) =>
      shield.filter((m) => m.uid === uid).map((m) => [m.version, m.mark, m.byTracker]);
    expect(of(104)).toEqual([
      [1, "yes", true],
      [2, "no", true],
    ]);
    expect(of(101)).toEqual([[1, "no", false]]);
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

  it("takes the Shield marks the mark page's roll call read instead of reading them again", async () => {
    const access = await signedIn();
    const filled = at("2026-11-21T12:20:00Z");
    const scope = { workspaceId: access.workspaceId, unionId: OGS };
    await fillRaidPrep(db, scope, "2026-11-20", { now: filled, zone: ZONE });
    const occasion = await raidPrep(access);
    const read = await callRead(db, access, occasion, "en", ZONE);
    if (!read) throw new Error("no roll call");
    const clock = { zone: ZONE, now: NOW };
    const once = await prepView(db, access, read.view.opened, clock, read.loaded);
    // The same view as reading the marks here: the tick's marks to check, as of the fill.
    expect(once).toEqual(await prepView(db, access, read.view.opened, clock));
    expect(once.toCheckAt).toBe(filled.getTime());
    // An officer's ✓ on 101 after the roll call's read: the passed marks are the ones shown, not a new read.
    await markOne(db, access, { occasion, uid: 101, mark: "yes", version: 1 }, NOW);
    const again = await prepView(db, access, read.view.opened, clock, read.loaded);
    expect(again.rows.get(101)?.fromTracker).toEqual({ unchecked: true });
  });

  it("shows the tick's marks as to check until Checked or a tap on the row (2026-11-21)", async () => {
    const access = await signedIn();
    const seen = { unionId: OGS, uid: 104, readAt: at("2026-11-21T12:10:00Z"), shielding: 1 };
    await db.insert(playerReads).values({ ...seen, shieldType: 0, mapUpdatedAt: NOW });
    const filled = at("2026-11-21T12:20:00Z");
    const scope = { workspaceId: access.workspaceId, unionId: OGS };
    // The morning check: ✓ for 101 and 104, ✗ No shield seen for 102; 103 has no morning reading.
    expect(await fillRaidPrep(db, scope, "2026-11-20", { now: filled, zone: ZONE })).toBe(3);
    // "Add a roll call" on another day of that week opens the tracker's Raid prep: one a week.
    const occasion = await raidPrep(access);
    const friday = await addCall(db, access, { kind: "shield", day: "2026-11-20" }, randomUUID());
    expect(friday.id).toBe(occasion.id);
    const view = async () => {
      const opened = await openOccasion(db, access, occasion);
      return prepView(db, access, opened as NonNullable<typeof opened>, { zone: ZONE, now: NOW });
    };
    const first = await view();
    expect(first.toCheckAt).toBe(filled.getTime());
    expect(first.rows.get(101)?.fromTracker).toEqual({ unchecked: true });
    expect(first.rows.get(102)?.fromTracker).toEqual({ unchecked: true });
    expect(first.rows.get(103)?.fromTracker).toBeNull();
    // A wall tap on 104's row checks that row; Checked checks the rest it saw.
    await markOne(db, access, { occasion, uid: 104, mark: "yes", version: 0, part: "wall" }, NOW);
    expect((await view()).rows.get(104)?.fromTracker).toEqual({ unchecked: false });
    expect(await checkTracker(db, access, { occasion, seen: filled.getTime() }, NOW)).toEqual({
      ok: true,
    });
    const checked = await view();
    expect(checked.toCheckAt).toBeNull();
    expect(checked.rows.get(101)?.fromTracker).toEqual({ unchecked: false });
    // ✓ on the tracker's ✓ makes it the officer's own.
    await markOne(db, access, { occasion, uid: 101, mark: "yes", version: 1 }, NOW);
    expect((await view()).rows.get(101)?.fromTracker).toBeNull();
  });
});

describe("the Discord summary's state on Raid prep (issue 585)", () => {
  const now = NOW.getTime();
  const on = { discord: true, channel: true, current: true };
  const reads = (newest: number) => ({ night: { read: 3, on: 2, at: newest }, morning: null });
  const none = { messageId: null, messageHash: null, postedAt: null };

  it("reads posted and deleted from the check's row, and infers the rest only before KvK", () => {
    const posted = { messageId: "9", messageHash: "h", postedAt: at("2026-11-21T01:36:00Z") };
    expect(summaryOf(posted, { ...on, discord: false }, reads(now), now)).toEqual({
      state: "posted",
      at: posted.postedAt.getTime(),
    });
    expect(summaryOf({ ...posted, messageHash: "gone" }, on, reads(now), now)).toEqual({
      state: "gone",
    });
    expect(summaryOf(none, { ...on, discord: false }, reads(now), now)).toEqual({ state: "off" });
    expect(summaryOf(none, { ...on, channel: false }, reads(now), now)).toEqual({ state: "unset" });
    expect(summaryOf(none, on, reads(now - 60_000), now)).toEqual({ state: "waiting" });
    expect(summaryOf(none, on, reads(now - 10 * 60_000), now)).toEqual({ state: "failed" });
  });

  it("shows nothing for a past week's check that recorded no message, never failed", () => {
    const past = { ...on, current: false };
    expect(summaryOf(none, past, reads(now - 7 * 86_400_000), now)).toBeNull();
  });
});
