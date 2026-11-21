import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFollowUps } from "../schema";
import { playerReads } from "../schema-squads";
import { theftFollowUps, thefts } from "../schema-thefts";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import {
  followUpsOf,
  followUpView,
  recordFollowUp,
  undoFollowUp,
  type FollowUpInput,
} from "./follow-up";
import { memberCard } from "./member-card";
import { factsOf, saveFacts } from "./member-facts";
import { createSession } from "./session";

const OGS = 67111155;
/** Friday 20 Nov; the server's clock (SERVER_TZ) is UTC−2, so the week is Mon 16 – Sun 22 Nov. */
const NOW = new Date("2026-11-20T12:00:00Z");
const CLOCK = { now: NOW, zone: "Etc/GMT+2" };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** An end-of-day read: uid → daily quest points (null: none that day), with nothing donated; `coins`
 * uid → Alliance Help coins (none when left out). */
async function endOfDay(
  day: string,
  members: Record<number, number | null>,
  coins: Record<number, number> = {},
) {
  const uids = Object.keys(members).map(Number);
  const at = new Date(`${day}T23:37:00-02:00`);
  await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
    rawJson: {
      members: uids.map((uid) => ({
        uid,
        nick_name: `P${uid}`,
        power: 1000,
        lv: 25,
        rank_code: 103,
        rank_label: "R3",
        daily_tech: null,
        active: members[uid],
        daily_honor: coins[uid] ?? null,
      })),
    },
  });
}

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // 101 has no quests and no donations on three reads (the offline proxy, D127); 103 joins on the 18th (new).
  await endOfDay("2026-11-17", { 101: null, 102: 10 });
  await endOfDay("2026-11-18", { 101: null, 102: 20, 103: 1 });
  await endOfDay("2026-11-19", { 101: null, 102: 30, 103: 2 });
});

async function signedIn(name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

const input = (uid: number, extra: Partial<FollowUpInput> = {}): FollowUpInput => ({
  uid,
  action: "talked",
  note: "",
  until: null,
  version: 0,
  requestId: randomUUID(),
  ...extra,
});

/** Members' "Missing info" (D98): every fact a new member is asked for. */
const ASK = ["squadMight", "troopTier", "adTech", "timeZone", "languages"];

const listed = async (access: WorkspaceAccess, now = NOW) =>
  (await followUpView(db, access, now, CLOCK.zone)).items.map((i) => [
    i.member.uid,
    i.checkIn,
    i.toAsk,
  ]);

describe("the Follow-up list (issue 340, D104)", () => {
  it("holds Check in and new members with Missing info; a record takes them off", async () => {
    const ana = await signedIn("Ana");
    expect(await listed(ana)).toEqual([
      [101, true, []],
      [103, false, ASK],
    ]);
    const done = await recordFollowUp(db, ana, input(101, { note: "Busy at work" }), CLOCK);
    expect(done).toEqual({ ok: true });
    expect(await listed(ana)).toEqual([[103, false, ASK]]);
    const history = await followUpsOf(db, ana, 101);
    expect(history).toMatchObject([{ action: "talked", note: "Busy at work", by: "Ana" }]);
  });

  it("writes On a break as an away fact, refusing another officer's newer one", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    const theirs = { text: "Trip", from: "2026-11-20", until: "2026-11-24" };
    await saveFacts(
      db,
      bo,
      103,
      [{ field: "away", version: 0, value: theirs, source: "officer" }],
      NOW,
      CLOCK.zone,
    );
    const breakFor = (version: number) =>
      input(103, { action: "break", until: "2026-11-27", note: "Exams", version });
    expect(await recordFollowUp(db, ana, breakFor(0), CLOCK)).toMatchObject({
      ok: false,
      code: "stale",
      field: "away",
      value: theirs,
      version: 1,
    });
    expect(await followUpsOf(db, ana, 103)).toEqual([]);
    expect(await recordFollowUp(db, ana, breakFor(1), CLOCK)).toEqual({ ok: true });
    expect(await followUpsOf(db, ana, 103)).toMatchObject([
      { action: "break", until: "2026-11-27" },
    ]);
  });

  it("stores a repeated send once and refuses a non-member and a past last day", async () => {
    const ana = await signedIn("Ana");
    const once = input(101);
    await recordFollowUp(db, ana, once, CLOCK);
    await recordFollowUp(db, ana, once, CLOCK);
    expect(await followUpsOf(db, ana, 101)).toHaveLength(1);
    expect(await recordFollowUp(db, ana, input(999), CLOCK)).toEqual({
      ok: false,
      code: "not_member",
    });
    const past = input(101, { action: "break", until: "2026-11-19" });
    expect(await recordFollowUp(db, ana, past, CLOCK)).toEqual({ ok: false, code: "bad_until" });
  });

  it("brings a Needs help member back next week while the signal still holds", async () => {
    const ana = await signedIn("Ana");
    await recordFollowUp(db, ana, input(101, { action: "help" }), CLOCK);
    expect((await listed(ana)).map(([uid]) => uid)).toEqual([103]);
    // Next week 101 still has no quests and no donations: Saturday, Sunday and Monday.
    await endOfDay("2026-11-21", { 101: null });
    await endOfDay("2026-11-22", { 101: null });
    await endOfDay("2026-11-23", { 101: null });
    expect(await listed(ana, new Date("2026-11-24T12:00:00Z"))).toEqual([[101, true, []]]);
  });

  it("lists the coins tip on 5 days below 1,000, never for days with no read, in the game's language (D140)", async () => {
    const ana = await signedIn("Ana");
    // 102 gave 400 coins on the four days before, none since; 101 is not in those reads.
    for (const day of ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]) {
      await endOfDay(day, { 102: 10 }, { 102: 400 });
    }
    await db.insert(playerReads).values({ unionId: OGS, uid: 102, readAt: NOW, language: "pt" });
    const items = (await followUpView(db, ana, NOW, CLOCK.zone)).items;
    expect(items.find((i) => i.member.uid === 102)).toMatchObject({
      checkIn: false,
      toAsk: [],
      tip: true,
      language: "pt-BR",
    });
    expect(items.find((i) => i.member.uid === 101)).toMatchObject({ tip: false, language: null });
  });

  it("drops a member whose signal clears, with nothing recorded", async () => {
    const ana = await signedIn("Ana");
    await endOfDay("2026-11-20", { 101: 9, 102: 40, 103: 3 });
    expect(await listed(ana, new Date("2026-11-21T12:00:00Z"))).toEqual([[103, false, ASK]]);
  });

  it("shows the member card's follow-ups newest first", async () => {
    const ana = await signedIn("Ana");
    await recordFollowUp(db, ana, input(101, { note: "Busy" }), CLOCK);
    const later = new Date(NOW.getTime() + 3_600_000);
    await recordFollowUp(db, ana, input(101, { action: "fine" }), { ...CLOCK, now: later });
    const card = await memberCard(db, ana, 101, {
      now: later,
      zone: CLOCK.zone,
      language: "en",
      t: WORKSPACE_DICTIONARIES.en,
    });
    expect(card?.followUps.lines).toEqual([
      "All fine, Fri, Nov 20 · ⁨Ana⁩",
      "Talked Fri, Nov 20: Busy · ⁨Ana⁩",
    ]);
  });

  it("undoes with an appended withdrawn record: back on the list, the break's fact put back", async () => {
    const ana = await signedIn("Ana");
    const off = input(101, { action: "break", until: "2026-11-25", note: "Exams" });
    await recordFollowUp(db, ana, off, CLOCK);
    expect((await listed(ana)).map(([uid]) => uid)).toEqual([103]);
    const undo = { uid: 101, target: off.requestId, requestId: randomUUID() };
    expect(await undoFollowUp(db, ana, undo, CLOCK)).toEqual({ ok: true });
    expect((await listed(ana)).map(([uid]) => uid)).toEqual([101, 103]);
    // Append-only: both rows stay; the card shows neither.
    const rows = await db.select({ action: memberFollowUps.action }).from(memberFollowUps);
    expect(rows.map((r) => r.action)).toEqual(["break", "withdrawn"]);
    expect(await followUpsOf(db, ana, 101)).toEqual([]);
    // The away note is cleared as a new version (v2), not deleted.
    const away = (await factsOf(db, ana)).get(101)?.away;
    expect([away?.value, away?.version]).toEqual([null, 2]);
    // A second undo of the same record finds nothing to withdraw.
    const again = { ...undo, requestId: randomUUID() };
    expect(await undoFollowUp(db, ana, again, CLOCK)).toEqual({ ok: false, code: "not_found" });
  });
});

describe("thefts on the Follow-up list (D104, amended 2026-11-19)", () => {
  it("lists every attacker at any step until Resolved", async () => {
    const ana = await signedIn("Ana");
    const at = new Date("2026-11-18T12:00:00Z");
    const theft = (name: string) => ({
      workspaceId: ana.workspaceId,
      at,
      attackerKey: `name:${name.toLowerCase()}`,
      attackerName: name,
      attackerTag: "QRX",
      kind: "ops" as const,
      source: "typed" as const,
      createdAt: at,
    });
    // Thornwick's only theft was deleted (D123): it is not on the list, whatever its step.
    await db
      .insert(thefts)
      .values([
        theft("Pebblewick"),
        theft("Fernby"),
        theft("Ashlock"),
        { ...theft("Thornwick"), deletedAt: NOW, deletedBy: ana.user.id },
      ]);
    const step = (key: string, state: "warned" | "resolved") => ({
      workspaceId: ana.workspaceId,
      attackerKey: key,
      state,
      changedBy: ana.user.id,
      changedAt: NOW,
    });
    await db
      .insert(theftFollowUps)
      .values([
        step("name:fernby", "warned"),
        step("name:ashlock", "resolved"),
        step("name:thornwick", "warned"),
      ]);
    const listedThefts = (await followUpView(db, ana, NOW, CLOCK.zone)).thefts;
    expect(listedThefts.map((a) => [a.name, a.followUp.state]).sort()).toEqual([
      ["Fernby", "warned"],
      ["Pebblewick", "open"],
    ]);
  });
});
