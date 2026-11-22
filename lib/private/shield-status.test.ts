// The Raid Shield check's line in the read status bar (D135, D137) against PGlite: one test per state.
// Friday's read under way, Friday's read done, Saturday's read under way, and no line while the check is
// off or once KvK has started. Counts and server times only. Drilldown batch C: the line counts Raid prep's
// set (a member away on the raid's Saturday left out, and said as a count) and links the week's Raid prep.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "../schema";
import { shieldChecks } from "../schema-shield";
import { playerReads, squadReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { prepView } from "./raid-prep";
import { readStatus } from "./read-status";
import { addCall } from "./roll-call";
import { callRead } from "./roll-call-view";
import { createSession } from "./session";

/** Friday 2026-11-20's read (UTC−2): the check's quota day. */
const DAY = "2026-11-20";
const ZONE = TEST_ENV.SERVER_TZ;
const at = (iso: string) => new Date(iso);
const t = WORKSPACE_DICTIONARIES.en;
const access = (on = true) =>
  ({
    workspaceId: 1,
    unionId: OWN_ALLIANCE_ID,
    slug: "lnk",
    features: { on: new Set(on ? ["shield_check"] : []), caps: { ai: 0, translate: 0 } },
  }) as unknown as WorkspaceAccess;
/** With no Raid prep that week yet, the line leads to the week's Roll call page. */
const WEEK = "/w/lnk/roll-call?week=2026-11-16";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(dailyReads)
    .values({ day: DAY, startedAt: at("2026-11-21T01:30:00Z"), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: 4,
    isFresh: true,
    sourceUpdatedAt: at("2026-11-21T01:30:00Z"),
    memberUids: [1, 2, 3, 4],
    memberNames: ["Aster", "Briar", "Cobble", "Dune"],
    memberPower: [1, 1, 1, 1],
    memberKills: [1, 1, 1, 1],
  });
  // Friday's read: 1 seen with a shield, 2 not, at 23:31 and 23:42 ST.
  const base = { unionId: OWN_ALLIANCE_ID, mapUpdatedAt: at("2026-11-21T00:32:00Z") };
  await db.insert(playerReads).values([
    { ...base, uid: 1, readAt: at("2026-11-21T01:31:00Z"), shielding: 1 },
    { ...base, uid: 2, readAt: at("2026-11-21T01:35:00Z"), shielding: 0 },
    { ...base, uid: 3, readAt: at("2026-11-21T01:42:00Z"), shielding: 0 },
  ]);
});

async function night(status: "running" | "done") {
  const startedAt = at("2026-11-21T01:31:00Z");
  await db
    .insert(squadReads)
    .values({ day: DAY, unionId: OWN_ALLIANCE_ID, status, startedAt, members: 4 });
  await db.insert(shieldChecks).values({ day: DAY, unionId: OWN_ALLIANCE_ID, nightAt: startedAt });
}

const shieldLine = async (now: Date, on = true, who = access(on)) =>
  (await readStatus(db, who, TEST_ENV, now, t, "en")).lines.find((l) => l.id === "shield");

describe("the Raid Shield check's status line (D137)", () => {
  it("Friday's read under way: counts and when it started", async () => {
    await night("running");
    expect(await shieldLine(at("2026-11-21T01:45:00Z"))).toEqual({
      id: "shield",
      tone: "progress",
      text: "Checking Raid Shields · 3 of 4 · started 23:31 ST",
      raidPrep: { href: WEEK, on: 0 },
    });
  });

  it("Friday's read done: the newest answer's time and who was seen with a shield", async () => {
    await night("done");
    expect(await shieldLine(at("2026-11-21T01:50:00Z"))).toEqual({
      id: "shield",
      tone: "quiet",
      text: "Raid Shield check 23:42 ST · 1 of 4 seen with a shield",
      raidPrep: { href: WEEK, on: 1 },
    });
  });

  it("Saturday's read under way, from its own start", async () => {
    await night("done");
    await db
      .update(shieldChecks)
      .set({ morningStatus: "running", morningStartedAt: at("2026-11-21T12:00:00Z") });
    const base = { unionId: OWN_ALLIANCE_ID, mapUpdatedAt: at("2026-11-21T11:40:00Z") };
    await db
      .insert(playerReads)
      .values({ ...base, uid: 1, readAt: at("2026-11-21T12:01:00Z"), shielding: 0 });
    expect(await shieldLine(at("2026-11-21T12:05:00Z"))).toMatchObject({
      tone: "progress",
      text: "Checking Raid Shields · 1 of 4 · started 10:00 ST",
    });
  });

  it("no line while the check is off, or once KvK has started", async () => {
    await night("done");
    expect(await shieldLine(at("2026-11-21T01:50:00Z"), false)).toBeUndefined();
    expect(await shieldLine(at("2026-11-21T14:00:00Z"))).toBeUndefined();
  });
});

describe("the status line counts Raid prep's members (drilldown batch C)", () => {
  /** Friday 23:50 ST, after the night check's last answer. */
  const NOW = at("2026-11-21T01:50:00Z");

  async function officer(): Promise<WorkspaceAccess> {
    await saveWorkspace(db, {
      ...{ unionId: OWN_ALLIANCE_ID, slug: "lnk" },
      ...{ discordGuildId: "1", leaderRoleIds: ["2"] },
    });
    const ws = await findWorkspaceBySlug(db, "lnk");
    const userId = await recordSignIn(db, ws?.id ?? 0, "lnk-rook", "Rook", NOW);
    const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
    const signed = await requireWorkspace(db, "lnk", { get: () => ({ value: token }) }, NOW);
    if (!signed.ok) throw new Error("no access");
    return signed;
  }

  it("leaves out a member away on raid day, as Raid prep's grid does, says how many, and leads to that Raid prep", async () => {
    const lnk = await officer();
    // Dune is seen with a shield but away from the raid's Saturday; Cobble's shield is on too.
    await db.insert(playerReads).values({
      ...{ unionId: OWN_ALLIANCE_ID, uid: 4, shielding: 1 },
      ...{ readAt: at("2026-11-21T01:40:00Z"), mapUpdatedAt: at("2026-11-21T00:32:00Z") },
    });
    await db.update(playerReads).set({ shielding: 1 }).where(eq(playerReads.uid, 3));
    await db.insert(memberFacts).values({
      ...{ workspaceId: lnk.workspaceId, uid: 4, field: "away", version: 1 },
      ...{ value: { text: "Trip", from: "2026-11-21", until: "2026-11-23" } },
      ...{ source: "officer", writtenAt: at("2026-11-20T20:00:00Z") },
    });
    await night("done");
    const { id } = await addCall(db, lnk, { kind: "shield", day: "2026-11-21" }, randomUUID());

    // Raid prep's grid on the same data: the asked members not away, and of them those seen with a shield.
    const read = await callRead(db, lnk, { id }, "en", ZONE);
    if (!read) throw new Error("no roll call");
    const prep = await prepView(db, lnk, read.view.opened, { zone: ZONE, now: NOW }, read.loaded);
    const grid = read.view.rows.filter((r) => r.away === null);
    const seen = grid.filter((r) => prep.rows.get(r.uid)?.tracker?.suggestion === "on");
    expect([grid.length, seen.length]).toEqual([3, 2]);

    expect(await shieldLine(NOW, true, lnk)).toEqual({
      id: "shield",
      tone: "quiet",
      text: `Raid Shield check 23:42 ST · ${seen.length} of ${grid.length} seen with a shield · 1 away`,
      raidPrep: { href: `/w/lnk/roll-call/mark?id=${id}`, on: seen.length },
    });
  });
});
