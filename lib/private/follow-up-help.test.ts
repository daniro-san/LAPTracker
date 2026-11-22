// #585 slice 2: Follow-up's "Needs help" group (a standing mark keeps a member on the list every week until an
// officer clears it), since when and who added the mark and why, last week's note as context, and Home's and
// Members' numbers from this week's records only. Invented members on PGlite; the server's clock is UTC−2.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isolate } from "../copy";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { helpMarkRows } from "../repo/member-follow-ups";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import {
  followUpCounts,
  followUpView,
  recordFollowUp,
  undoFollowUp,
  type FollowUpInput,
} from "./follow-up";
import { memberCard } from "./member-card";
import { factsOf, saveFacts } from "./member-facts";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
/** A server time (UTC−2) as an instant: "2026-11-16T00:05" is Mon 16 Nov 00:05 ST. */
const st = (local: string) => new Date(`${local}:00-02:00`);
/** Fri 20 Nov 10:00 ST: the game week is Mon 16 – Sun 22 Nov; last week is Mon 9 – Sun 15 Nov. */
const NOW = st("2026-11-20T10:00");
const at = (now: Date) => ({ now, zone: ZONE });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** An end-of-day read: uid → daily quest points (null: none that day), nothing donated. */
async function endOfDay(day: string, members: Record<number, number | null>) {
  const uids = Object.keys(members).map(Number);
  const readAt = new Date(`${day}T23:37:00-02:00`);
  await db.insert(dailyReads).values({ day, startedAt: readAt, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: readAt,
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
        daily_honor: 1000,
      })),
    },
  });
}

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // 101 is quiet on three reads (D127), 102 is active (no reason at all), 103 joined on the 18th (new).
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

/** "They need help" on Follow-up, with the status version the page saw. */
async function markHelp(access: WorkspaceAccess, uid: number, note: string, when: Date) {
  const version = (await factsOf(db, access)).get(uid)?.status?.version ?? 0;
  const record = input(uid, { action: "help", note, version });
  await recordFollowUp(db, access, record, at(when));
  return record;
}

/** Edit info › Status, as the facts editor saves it. */
async function setStatus(access: WorkspaceAccess, uid: number, value: "help" | null, when: Date) {
  const version = (await factsOf(db, access)).get(uid)?.status?.version ?? 0;
  const change = { field: "status" as const, version, value, source: "officer" as const };
  await saveFacts(db, access, uid, [change], when, ZONE);
}

const helped = async (access: WorkspaceAccess, now: Date) =>
  (await followUpView(db, access, now, ZONE)).items.filter((i) => i.help).map((i) => i.member.uid);

const t = WORKSPACE_DICTIONARIES.en;

describe("Follow-up's Needs help group (#585 slice 2)", () => {
  it("keeps a member marked Needs help on the list each week until the mark is cleared, paused by a break", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    // Fri 13 Nov (last week): 102 has no reason at all, so before this slice they were on no list.
    await markHelp(
      ana,
      102,
      "Lost the main squad, asked for help rebuilding",
      st("2026-11-13T12:00"),
    );
    const view = await followUpView(db, ana, NOW, ZONE);
    expect(view.items.find((i) => i.member.uid === 102)).toMatchObject({
      help: true,
      checkIn: false,
    });
    // A Talked this week moves them to Noted until Sunday; on Monday they are back.
    await recordFollowUp(db, bo, input(102), at(st("2026-11-18T09:00")));
    expect(await helped(ana, NOW)).toEqual([]);
    expect((await followUpView(db, ana, NOW, ZONE)).noted.map((n) => n.member.uid)).toEqual([102]);
    expect(await helped(ana, st("2026-11-23T12:00"))).toEqual([102]);
    // An away note Mon 23 – Wed 25 Nov pauses the mark; on Thursday it is back.
    const away = { text: "", from: "2026-11-23", until: "2026-11-25" };
    const change = { field: "away" as const, version: 0, value: away, source: "officer" as const };
    await saveFacts(db, bo, 102, [change], st("2026-11-23T12:00"), ZONE);
    expect(await helped(ana, st("2026-11-24T12:00"))).toEqual([]);
    expect(await helped(ana, st("2026-11-26T12:00"))).toEqual([102]);
    // Cleared ("No longer needs help" saves the status as cleared): off the list.
    await setStatus(bo, 102, null, st("2026-11-26T13:00"));
    expect(await helped(ana, st("2026-11-26T14:00"))).toEqual([]);
  });

  it("says since when and who added the mark and why, from the mark that stands, on the row and the card", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    await markHelp(
      ana,
      102,
      "Lost the main squad, asked for help rebuilding",
      st("2026-11-13T12:00"),
    );
    // 101: Ana marks on Thu 12 Nov, Bo marks again on Fri 13 Nov and undoes it: Ana's mark stands.
    await markHelp(ana, 101, "Unsure about the shield timing", st("2026-11-12T12:00"));
    const again = await markHelp(bo, 101, "Asked again", st("2026-11-13T12:00"));
    const undo = { uid: 101, target: again.requestId, requestId: randomUUID() };
    await undoFollowUp(db, bo, undo, at(st("2026-11-13T12:01")));
    // 103: set in Edit info, with no note.
    await setStatus(bo, 103, "help", st("2026-11-19T08:00"));
    const marks = Object.fromEntries(
      (await followUpView(db, ana, NOW, ZONE)).items.map((i) => [i.member.uid, i.mark]),
    );
    expect(marks).toEqual({
      101: { at: st("2026-11-12T12:00"), by: "Ana", note: "Unsure about the shield timing" },
      102: {
        at: st("2026-11-13T12:00"),
        by: "Ana",
        note: "Lost the main squad, asked for help rebuilding",
      },
      103: { at: st("2026-11-19T08:00"), by: "Bo", note: null },
    });
    const card = await memberCard(db, ana, 102, { now: NOW, zone: ZONE, language: "en", t });
    expect(card?.statusLabel).toBe("Needs help");
    expect(card?.statusMark).toEqual([
      `Since Fri, Nov 13 · added by ${isolate("Ana")}`,
      "“Lost the main squad, asked for help rebuilding”",
    ]);
  });

  it("shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own", async () => {
    const [ana, tomas] = [await signedIn("Ana"), await signedIn("Tomas")];
    // 101, quiet: Thu 5 Nov (two weeks back), then Thu 12 Nov with a note; the newest is the context.
    await recordFollowUp(db, ana, input(101, { note: "Busy" }), at(st("2026-11-05T12:00")));
    const holiday = input(101, { note: "on holiday" });
    await recordFollowUp(db, tomas, holiday, at(st("2026-11-12T12:00")));
    // 103, new: a record two weeks back, and a Talked on Sun 15 Nov 23:50 ST undone on Mon 00:05 ST.
    await recordFollowUp(db, ana, input(103), at(st("2026-11-05T12:00")));
    const sunday = input(103);
    await recordFollowUp(db, ana, sunday, at(st("2026-11-15T23:50")));
    const undo = { uid: 103, target: sunday.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, at(st("2026-11-16T00:05")));
    // 102: last week's only record is the one that wrote the Needs help mark its row already names.
    await markHelp(ana, 102, "Asked for help rebuilding", st("2026-11-13T12:00"));
    const view = await followUpView(db, ana, NOW, ZONE);
    const last = Object.fromEntries(view.items.map((i) => [i.member.uid, i.lastWeek]));
    expect(last).toEqual({
      101: {
        uid: 101,
        action: "talked",
        note: "on holiday",
        until: null,
        at: st("2026-11-12T12:00"),
        by: "Tomas",
      },
      102: null,
      103: null,
    });
  });

  it("takes this week's list and Home's numbers from this week's records only, the Needs help group counted", async () => {
    const ana = await signedIn("Ana");
    // Last week's Talked does not take 101 off this week's list, nor count as noted.
    await recordFollowUp(db, ana, input(101), at(st("2026-11-13T09:00")));
    await markHelp(ana, 102, "Asked for help rebuilding", st("2026-11-13T12:00"));
    const counts = async () => {
      const page = await followUpView(db, ana, NOW, ZONE);
      const home = await followUpCounts(db, ana, await membersView(db, ana, NOW, ZONE), NOW, ZONE);
      return { home, page: { toLook: page.items.length, noted: page.noted.length } };
    };
    expect(await counts()).toEqual({
      home: { toLook: 3, noted: 0 },
      page: { toLook: 3, noted: 0 },
    });
    // The Needs help member noted this week leaves the number to look at and joins the noted one.
    await recordFollowUp(db, ana, input(102, { action: "fine" }), at(st("2026-11-19T12:00")));
    expect(await counts()).toEqual({
      home: { toLook: 2, noted: 1 },
      page: { toLook: 2, noted: 1 },
    });
  });

  it("reads a mark set again after it was cleared from its new run only, the older record's Undo changing nothing (D149)", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    // v1 Ana's "They need help" on Thu 12 Nov; v2 cleared by Bo; v3 set again by Bo in Edit info on Fri 13.
    const first = await markHelp(
      ana,
      101,
      "Unsure about the shield timing",
      st("2026-11-12T12:00"),
    );
    await setStatus(bo, 101, null, st("2026-11-12T13:00"));
    await setStatus(bo, 101, "help", st("2026-11-13T08:00"));
    // Ana then undoes her record from before the run: the status stays as Bo set it.
    const undo = { uid: 101, target: first.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, at(st("2026-11-13T09:00")));
    // The read holds only the run; no "help" record wrote a version in it, so no record is read.
    const { versions, records } = await helpMarkRows(db, ana.workspaceId, [101]);
    expect(versions.map((v) => v.version)).toEqual([3]);
    expect(records.map((r) => r.action)).toEqual([]);
    // The row and the card name Bo's mark, with no note.
    const mark = (await followUpView(db, ana, NOW, ZONE)).items.find((i) => i.member.uid === 101);
    expect(mark?.mark).toEqual({ at: st("2026-11-13T08:00"), by: "Bo", note: null });
    const card = await memberCard(db, ana, 101, { now: NOW, zone: ZONE, language: "en", t });
    expect(card?.statusMark).toEqual([`Since Fri, Nov 13 · added by ${isolate("Bo")}`]);
  });

  it("names the officer whose Needs help started first and was saved second, on the version the other wrote", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    // Bo taps "They need help" at 12:00:00, Ana at 12:00:01; Ana's save lands first and writes v1. Bo's
    // request, stamped 12:00:00, finds the same value and records v1: Bo's is the newest record of the mark.
    await recordFollowUp(
      db,
      ana,
      input(102, { action: "help", note: "Ana's note" }),
      at(st("2026-11-13T12:00")),
    );
    const bos = input(102, { action: "help", note: "Lost the main squad" });
    await recordFollowUp(db, bo, bos, at(new Date(st("2026-11-13T12:00").getTime() - 1000)));
    const { versions, records } = await helpMarkRows(db, ana.workspaceId, [102]);
    expect(versions.map((v) => v.version)).toEqual([1]);
    expect(records.map((r) => [r.by, r.factVersion])).toEqual([
      ["Ana", 1],
      ["Bo", 1],
    ]);
    const mark = (await followUpView(db, ana, NOW, ZONE)).items.find((i) => i.member.uid === 102);
    expect(mark?.mark).toEqual({
      at: new Date(st("2026-11-13T12:00").getTime() - 1000),
      by: "Bo",
      note: "Lost the main squad",
    });
  });
});

describe("Undo of a Needs help record (#647)", () => {
  const status = async (access: WorkspaceAccess, uid: number) =>
    (await factsOf(db, access)).get(uid)?.status?.value ?? null;
  const markOf = async (access: WorkspaceAccess, uid: number, now: Date) =>
    (await followUpView(db, access, now, ZONE)).items.find((i) => i.member.uid === uid)?.mark;
  const undo = async (access: WorkspaceAccess, r: FollowUpInput, when: Date) => {
    const request = { uid: r.uid, target: r.requestId, requestId: randomUUID() };
    expect(await undoFollowUp(db, access, request, at(when))).toEqual({ ok: true });
  };

  it("keeps another officer's standing mark when the undone save wrote no version of its own", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    await markHelp(ana, 101, "Unsure about the shield timing", st("2026-11-12T09:00"));
    // Bo's sheet opened before Ana's mark (version 0): the same value reuses Ana's version.
    const again = input(101, { action: "help", note: "Asked again" });
    await recordFollowUp(db, bo, again, at(st("2026-11-12T10:00")));
    await undo(bo, again, st("2026-11-12T10:01"));
    expect(await markOf(ana, 101, NOW)).toEqual({
      at: st("2026-11-12T09:00"),
      by: "Ana",
      note: "Unsure about the shield timing",
    });
    const card = await memberCard(db, ana, 101, { now: NOW, zone: ZONE, language: "en", t });
    expect(card?.statusLabel).toBe("Needs help");
    expect(card?.statusMark).toEqual([
      `Since Thu, Nov 12 · added by ${isolate("Ana")}`,
      "“Unsure about the shield timing”",
    ]);
  });

  it("keeps last week's mark when a save that reused it on Sunday is undone on Monday", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    await markHelp(ana, 102, "Asked for help rebuilding", st("2026-11-13T12:00"));
    const sunday = input(102, { action: "help" });
    await recordFollowUp(db, bo, sunday, at(st("2026-11-15T23:50")));
    await undo(bo, sunday, st("2026-11-16T00:05"));
    expect(await status(ana, 102)).toBe("help");
    expect(await markOf(ana, 102, NOW)).toEqual({
      at: st("2026-11-13T12:00"),
      by: "Ana",
      note: "Asked for help rebuilding",
    });
  });

  it("puts a different value back when the undone save wrote a new version over it", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    const onBreak = { field: "status", version: 0, value: "break", source: "officer" } as const;
    await saveFacts(db, ana, 103, [onBreak], st("2026-11-18T09:00"), ZONE);
    const help = await markHelp(bo, 103, "", st("2026-11-19T09:00"));
    await undo(bo, help, st("2026-11-19T09:01"));
    expect(await status(ana, 103)).toBe("break");
  });

  it("clears an officer's own mark when they undo it", async () => {
    const ana = await signedIn("Ana");
    const help = await markHelp(ana, 101, "", st("2026-11-19T09:00"));
    await undo(ana, help, st("2026-11-19T09:01"));
    expect(await status(ana, 101)).toBeNull();
    expect(await helped(ana, NOW)).toEqual([]);
  });
});
