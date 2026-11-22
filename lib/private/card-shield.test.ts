// The member card's Raid Shield block (issue 634, option A) against a real Postgres (PGlite): only from
// Friday's night check (23:30 ST) until KvK starts (Saturday 12:00 ST), in server time; an officer's Shield
// mark leads, the tracker's checkpoints otherwise, "not read yet" before any reading, and only "Away on raid
// day" for a member away on the raid's Saturday (D75, D103). Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { fillRaidPrep } from "../raid-prep-fill";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { playerReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { cardShield } from "./card-shield";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import type { MemberFacts } from "./fact-fields";
import { addCall, markOne, markRest } from "./roll-call";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
/** Server time (UTC−2) to an instant. */
const st = (local: string) => new Date(`${local}:00-02:00`);
/** Saturday 21 Nov 10:40 ST: after both checks, before KvK. */
const NOW = st("2026-11-21T10:40");
const NIGHT = st("2026-11-20T23:31");
const MORNING = st("2026-11-21T10:04");
const UIDS = [101, 102, 103, 104, 105];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // Friday's roster: marks and the tracker's fill take only the alliance's members.
  await db.insert(dailyReads).values({ day: "2026-11-20", startedAt: NIGHT, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-20",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NIGHT,
    memberUids: UIDS,
    memberNames: UIDS.map((u) => `Fennick${u}`),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
});

async function signedIn(): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** One stored reading of `uid` by the alliance's own check. */
const reading = (uid: number, readAt: Date, shielding: number, map: string) => ({
  unionId: OGS,
  uid,
  readAt,
  shielding,
  shieldType: 0,
  mapUpdatedAt: st(map),
});

const block = (access: WorkspaceAccess, uid: number, now = NOW, facts: MemberFacts = {}) =>
  cardShield(db, access, { uid, facts }, { now, zone: ZONE, t: WORKSPACE_DICTIONARIES.en });

const shieldOff = (access: WorkspaceAccess): WorkspaceAccess => ({
  ...access,
  features: {
    ...access.features,
    on: new Set([...access.features.on].filter((f) => f !== "shield_check")),
  },
});

describe("the member card's Raid Shield window (issue 634)", () => {
  it("shows the block from Friday 23:30 ST until before Saturday 12:00 ST, the same raid across midnight", async () => {
    const access = await signedIn();
    await db.insert(playerReads).values(reading(101, NIGHT, 1, "2026-11-20T22:33"));
    const night = {
      head: "Raid Shield",
      lines: [{ text: "Night check: shield seen", scan: "map from 22:33 ST", tone: "plain" }],
    };
    expect(await block(access, 101, st("2026-11-20T23:29"))).toBeNull();
    expect(await block(access, 101, st("2026-11-20T23:30"))).toEqual(night);
    // After the reset, Saturday's card still counts from Friday's check.
    expect(await block(access, 101, st("2026-11-21T00:05"))).toEqual(night);
    expect(await block(access, 101, st("2026-11-21T11:59"))).toEqual(night);
    expect(await block(access, 101, st("2026-11-21T12:00"))).toBeNull();
    expect(await block(access, 101, st("2026-11-19T23:45"))).toBeNull();
  });

  it("shows nothing while the Raid Shield check is off, inside the window too", async () => {
    const access = await signedIn();
    await db.insert(playerReads).values(reading(101, NIGHT, 1, "2026-11-20T22:33"));
    expect(await block(shieldOff(access), 101)).toBeNull();
  });
});

describe("the member card's Raid Shield states (issue 634)", () => {
  beforeEach(async () => {
    await db
      .insert(playerReads)
      .values([
        reading(101, NIGHT, 1, "2026-11-20T22:33"),
        reading(101, MORNING, 0, "2026-11-21T07:15"),
        reading(102, NIGHT, 1, "2026-11-20T22:33"),
        reading(103, MORNING, 1, "2026-11-21T08:02"),
        reading(105, NIGHT, 0, "2026-11-20T22:33"),
      ]);
  });

  it("lists the tracker's checkpoints newest first, the older muted, “no shield seen” in the attention tone", async () => {
    const access = await signedIn();
    expect(await block(access, 101)).toEqual({
      head: "Raid Shield",
      lines: [
        { text: "Morning check: no shield seen", scan: "map from 07:15 ST", tone: "attention" },
        { text: "Night check: shield seen", scan: "map from 22:33 ST", tone: "muted" },
      ],
    });
  });

  it("leads with an officer's Shield mark, the newest checkpoint muted under it", async () => {
    const access = await signedIn();
    const occasion = await addCall(db, access, { kind: "shield", day: "2026-11-21" }, randomUUID());
    await markOne(db, access, { occasion, uid: 101, mark: "yes", version: 0 }, NOW);
    await markOne(db, access, { occasion, uid: 102, mark: "no", version: 0 }, NOW);
    // "The rest" marks 104 "No problem seen".
    const rest = await markRest(db, access, { occasion, uids: [104] }, { now: NOW, zone: ZONE });
    expect(rest).toMatchObject({ ok: true, written: [{ uid: 104 }] });
    expect((await block(access, 101))?.lines).toEqual([
      { text: "Raid prep: Shield up", scan: null, tone: "plain" },
      { text: "Morning check: no shield seen", scan: "map from 07:15 ST", tone: "muted" },
    ]);
    expect((await block(access, 102))?.lines).toEqual([
      { text: "Raid prep: No shield", scan: null, tone: "attention" },
      { text: "Night check: shield seen", scan: "map from 22:33 ST", tone: "muted" },
    ]);
    expect((await block(access, 104))?.lines).toEqual([
      { text: "Raid prep: No problem seen", scan: null, tone: "plain" },
    ]);
    // A mark the officer cleared leads no more: the checkpoints are back.
    await markOne(db, access, { occasion, uid: 101, mark: null, version: 1 }, NOW);
    expect((await block(access, 101))?.lines[0]?.text).toBe("Morning check: no shield seen");
  });

  it("does not lead with the tracker's own mark: its checkpoint says it, with the map time", async () => {
    const access = await signedIn();
    await addCall(db, access, { kind: "shield", day: "2026-11-21" }, randomUUID());
    const scope = { workspaceId: access.workspaceId, unionId: OGS };
    // The morning check writes ✓ for 103, as the tracker's.
    expect(await fillRaidPrep(db, scope, "2026-11-20", { now: NOW, zone: ZONE })).toBeGreaterThan(
      0,
    );
    expect((await block(access, 103))?.lines).toEqual([
      { text: "Morning check: shield seen", scan: "map from 08:02 ST", tone: "plain" },
    ]);
  });

  it("says “Tracker: not read yet” for a member no check has read", async () => {
    const access = await signedIn();
    expect((await block(access, 104))?.lines).toEqual([
      { text: "Tracker: not read yet", scan: null, tone: "plain" },
    ]);
  });

  it("says only “Away on raid day” for a member away on the raid's Saturday, whatever the reading", async () => {
    const access = await signedIn();
    const away = (from: string, until: string): MemberFacts => ({
      away: {
        value: { text: "Trip", from, until },
        source: "officer",
        version: 1,
        at: NOW.toISOString(),
      },
    });
    expect((await block(access, 105, NOW, away("2026-11-21", "2026-11-22")))?.lines).toEqual([
      { text: "Away on raid day", scan: null, tone: "plain" },
    ]);
    // Back on Friday: the Saturday is not away, so the reading shows.
    const back = await block(access, 105, NOW, away("2026-11-18", "2026-11-20"));
    expect(back?.lines[0]?.text).toBe("Night check: no shield seen");
  });

  it("speaks the officer's language: Brazilian Portuguese and French", async () => {
    const access = await signedIn();
    const at = (language: "pt-BR" | "fr", uid: number) =>
      cardShield(
        db,
        access,
        { uid, facts: {} },
        { now: NOW, zone: ZONE, t: WORKSPACE_DICTIONARIES[language] },
      );
    expect(await at("pt-BR", 104)).toEqual({
      head: "Escudo de raid",
      lines: [{ text: "Tracker: ainda sem leitura", scan: null, tone: "plain" }],
    });
    expect((await at("fr", 101))?.lines[0]).toEqual({
      text: "Matin : pas de bouclier vu",
      scan: "carte de 07:15 ST",
      tone: "attention",
    });
  });
});
