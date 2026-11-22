// #585 "One worklist": Follow-up's "Noted this week" and the two numbers Home and Members show, by the
// Follow-up list's own rule, week and members view. Invented members on PGlite; the server's clock is UTC−2.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { noQueryDb, openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFollowUps } from "../schema";
import { workspaceFeatures } from "../schema-features";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import {
  followUpCounts,
  followUpView,
  recordFollowUp,
  undoFollowUp,
  type FollowUpInput,
} from "./follow-up";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
/** A server time (UTC−2) as an instant: "2026-11-16T00:05" is Mon 16 Nov 00:05 ST. */
const st = (local: string) => new Date(`${local}:00-02:00`);
/** Fri 20 Nov 10:00 ST: the game week is Mon 16 – Sun 22 Nov. */
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
  // 101 is quiet on three reads (D127), 102 is active, 103 joined on the 18th (new, every fact to ask).
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

const noted = async (access: WorkspaceAccess, now: Date) =>
  (await followUpView(db, access, now, ZONE)).noted.map((d) => [
    d.member.uid,
    d.record.action,
    d.record.by,
  ]);

describe("who was noted this week, and the two numbers Home and Members show (#585)", () => {
  it("lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    // Sun 15 Nov 23:59 ST: the week before.
    await recordFollowUp(db, ana, input(101), at(st("2026-11-15T23:59")));
    // Mon 16 Nov 00:05 ST: this week.
    await recordFollowUp(db, ana, input(102, { action: "fine" }), at(st("2026-11-16T00:05")));
    // Two records for 103: the newest (Bo's break on Wednesday) is the row.
    await recordFollowUp(db, ana, input(103), at(st("2026-11-17T10:00")));
    const off = input(103, { action: "break", until: "2026-11-24", note: "Exams" });
    await recordFollowUp(db, bo, off, at(st("2026-11-18T09:00")));
    // 101 talked to on Thursday, then undone: not noted.
    const talked = input(101);
    await recordFollowUp(db, ana, talked, at(st("2026-11-19T08:00")));
    const undo = { uid: 101, target: talked.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, at(st("2026-11-19T08:01")));
    expect(await noted(ana, NOW)).toEqual([
      [103, "break", "Bo"],
      [102, "fine", "Ana"],
    ]);
    const [first] = (await followUpView(db, ana, NOW, ZONE)).noted;
    expect([first?.record.note, first?.record.until]).toEqual(["Exams", "2026-11-24"]);
  });

  it("leaves a member who left the alliance out of the noted and out of both numbers", async () => {
    const ana = await signedIn("Ana");
    await recordFollowUp(db, ana, input(102, { action: "fine" }), at(NOW));
    // 104 was noted on Tuesday and is in no read since: they left.
    await db.insert(memberFollowUps).values({
      workspaceId: ana.workspaceId,
      uid: 104,
      action: "talked",
      writtenBy: ana.user.id,
      writtenAt: st("2026-11-17T12:00"),
      requestId: randomUUID(),
    });
    expect(await noted(ana, NOW)).toEqual([[102, "fine", "Ana"]]);
    const view = await membersView(db, ana, NOW, ZONE);
    expect(await followUpCounts(db, ana, view, NOW, ZONE)).toEqual({ toLook: 2, noted: 1 });
  });

  it("gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update", async () => {
    const ana = await signedIn("Ana");
    // Last week's note (Friday) and this week's (Mon 23 Nov 00:05 ST); the newest read is Thursday's,
    // so the members view's week is still 16 – 22 Nov.
    await recordFollowUp(db, ana, input(102, { action: "fine" }), at(NOW));
    const monday = st("2026-11-23T00:30");
    await recordFollowUp(db, ana, input(101), at(st("2026-11-23T00:05")));
    const page = await followUpView(db, ana, monday, ZONE);
    const view = await membersView(db, ana, monday, ZONE);
    expect(view.week[0]).toBe("2026-11-16");
    const counts = await followUpCounts(db, ana, view, monday, ZONE);
    expect(counts).toEqual({ toLook: page.items.length, noted: page.noted.length });
    expect(page.noted.map((d) => d.member.uid)).toEqual([101]);
    expect(page.items.map((i) => i.member.uid)).toEqual([103]);
  });

  it("reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126)", async () => {
    const ws = await findWorkspaceBySlug(db, "ogs");
    await db.insert(workspaceFeatures).values({
      workspaceId: ws?.id ?? 0,
      switches: {},
      allianceSwitches: { follow_up: false },
    });
    const ana = await signedIn("Ana");
    const view = await membersView(db, ana, NOW, ZONE);
    expect(await followUpCounts(noQueryDb, ana, view, NOW, ZONE)).toBeNull();
  });

  it("reads nothing and gives no numbers before the alliance's first daily update", async () => {
    const ana = await signedIn("Ana");
    const view = { ...(await membersView(db, ana, NOW, ZONE)), early: true };
    expect(await followUpCounts(noQueryDb, ana, view, NOW, ZONE)).toBeNull();
  });
});
