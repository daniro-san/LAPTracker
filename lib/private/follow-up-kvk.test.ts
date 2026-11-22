// #585 slice 5: Follow-up's "After KvK, offer help", from Insights' heavy-hit rule, for the week after a KvK,
// until an officer writes something after it; Home's and Members' numbers count it; Insights links to it while
// someone is in it. Invented members on PGlite; the server's clock is UTC−2. KvK Sat 21 Nov 12:00 ST, Start
// read 10:00, End read 14:00, the night read 23:37.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberFacts,
  memberSnapshots,
  snapshots,
} from "../schema";
import { workspaceFeatures } from "../schema-features";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import {
  followUpCounts,
  followUpView,
  recordFollowUp,
  undoFollowUp,
  type FollowUpInput,
} from "./follow-up";
import { insightsView } from "./insights";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
/** A server time (UTC−2) as an instant: "2026-11-22T10:00" is Sun 22 Nov 10:00 ST. */
const st = (local: string) => new Date(`${local}:00-02:00`);
const at = (now: Date) => ({ now, zone: ZONE });

/** Might at the Start and End reads: 101, 102, 103 and 104 lost 40%; 105 lost nothing. */
const START = { 101: 100_000, 102: 90_000, 103: 80_000, 104: 70_000, 105: 60_000 };
const HIT = new Set([101, 102, 103, 104]);
const mightOn = (uid: keyof typeof START, n: number) =>
  // Still about 60% of the Start after the KvK; growing a little every day, so no "might the same".
  (HIT.has(uid) ? START[uid] * 0.6 : START[uid]) + n * 100;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

const DAY_MS = 86_400_000;
const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** The end-of-day read of `day`: everyone active, coins at the cap. */
async function endOfDay(day: string) {
  const n = (Date.parse(`${day}T00:00:00Z`) - Date.parse("2026-11-18T00:00:00Z")) / DAY_MS;
  const uids = Object.keys(START).map(Number) as (keyof typeof START)[];
  const readAt = new Date(`${day}T23:37:00-02:00`);
  const power = uids.map((u) => (day >= "2026-11-21" ? mightOn(u, n) : START[u] + n * 100));
  await db.insert(dailyReads).values({ day, startedAt: readAt, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: readAt,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: power,
    memberKills: uids.map(() => 0),
    rawJson: {
      members: uids.map((uid, i) => ({
        uid,
        nick_name: `P${uid}`,
        power: power[i],
        lv: 25,
        rank_code: 103,
        rank_label: "R3",
        daily_tech: 3000,
        active: 400,
        daily_honor: 1000,
      })),
    },
  });
}

/** The reads from `first` through `last`. */
async function reads(first: string, last: string) {
  for (let day = first; day <= last; day = nextDay(day)) await endOfDay(day);
}

/** The KvK of Sat 21 Nov with its Start (10:00 ST) and End (14:00 ST) reads. */
async function kvk() {
  const eventAt = st("2026-11-21T12:00");
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday",
      eventAtUtc: eventAt,
      allianceIds: [OGS],
      beforeAt: st("2026-11-21T10:00"),
      afterAt: st("2026-11-21T14:00"),
    })
    .returning({ id: events.id });
  for (const [phase, startedAt] of [
    ["before", st("2026-11-21T10:00")],
    ["after", st("2026-11-21T14:00")],
  ] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: snap?.id ?? 0, unionId: OGS, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(START).map(([uid, might]) => ({
        allianceSnapshotId: row?.id ?? 0,
        uid: Number(uid),
        name: `P${uid}`,
        power: phase === "after" && HIT.has(Number(uid)) ? might * 0.6 : might,
      })),
    );
  }
}

async function signedIn(name: string, now: Date): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, now);
  const { token } = await createSession(db, ws?.id ?? 0, userId, now, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, now);
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

/** Follow-up as of `now`: the KvK's day, the After KvK group, Needs help, and Home's numbers beside its own. */
async function seen(access: WorkspaceAccess, now: Date) {
  const page = await followUpView(db, access, now, ZONE);
  const counts = await followUpCounts(
    db,
    access,
    await membersView(db, access, now, ZONE),
    now,
    ZONE,
  );
  const uids = (keep: (i: (typeof page.items)[number]) => boolean) =>
    page.items.filter(keep).map((i) => i.member.uid);
  return {
    day: page.kvkDay,
    kvk: uids((i) => i.kvk && !i.help),
    help: uids((i) => i.help),
    all: page.items.map((i) => i.member.uid),
    noted: page.noted.map((n) => n.member.uid),
    equal: counts?.toLook === page.items.length && counts?.noted === page.noted.length,
  };
}

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await kvk();
});

/** 103 marked Needs help on Fri 13 Nov; 104 on a break from Thu 19 to Mon 30 Nov (an away note). */
async function marks(ana: WorkspaceAccess) {
  await recordFollowUp(db, ana, input(103, { action: "help" }), at(st("2026-11-13T12:00")));
  await db.insert(memberFacts).values({
    workspaceId: ana.workspaceId,
    uid: 104,
    field: "away",
    version: 1,
    value: { text: "", from: "2026-11-19", until: "2026-11-30" },
    source: "officer",
    writtenBy: ana.user.id,
    writtenAt: st("2026-11-19T12:00"),
  });
}

describe("Follow-up's After KvK, offer help (#585 slice 5)", () => {
  it("lists the KvK's heavy hits from its night read through the Friday after, a member on a break or marked Needs help kept out of the group", async () => {
    const ana = await signedIn("Ana", st("2026-11-21T22:00"));
    // KvK day, before the night read: the KvK waits for it, so nobody is listed for it yet.
    await reads("2026-11-18", "2026-11-20");
    await marks(ana);
    expect(await seen(ana, st("2026-11-21T22:00"))).toMatchObject({
      day: null,
      kvk: [],
      equal: true,
    });
    // After the night read, Sunday: 101 and 102; 103 stays under Needs help; 104's break leaves them out.
    await reads("2026-11-21", "2026-11-21");
    const sunday = await seen(ana, st("2026-11-22T10:00"));
    expect(sunday).toMatchObject({ day: "2026-11-21", kvk: [101, 102], help: [103], equal: true });
    expect(sunday.all).not.toContain(104);
    // The Friday after, still; the next KvK day (Saturday morning), gone, with Home's numbers following.
    await reads("2026-11-22", "2026-11-26");
    expect(await seen(ana, st("2026-11-27T10:00"))).toMatchObject({ kvk: [101, 102], equal: true });
    await reads("2026-11-27", "2026-11-27");
    expect(await seen(ana, st("2026-11-28T10:00"))).toMatchObject({
      day: null,
      kvk: [],
      help: [103],
      equal: true,
    });
  });

  it("takes a member someone wrote about after the KvK out of the group until its week ends, not back on Monday; an undone note puts them back", async () => {
    const ana = await signedIn("Ana", st("2026-11-22T10:00"));
    await reads("2026-11-18", "2026-11-21");
    await marks(ana);
    await recordFollowUp(db, ana, input(101), at(st("2026-11-22T11:00")));
    const undone = input(102);
    await recordFollowUp(db, ana, undone, at(st("2026-11-22T12:00")));
    const undo = { uid: 102, target: undone.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, at(st("2026-11-22T12:01")));
    expect(await seen(ana, st("2026-11-22T13:00"))).toMatchObject({
      kvk: [102],
      noted: [101],
      equal: true,
    });
    // Monday: Sunday's talk is last week's, and 101 is still not back; Home's numbers read back to it.
    await reads("2026-11-22", "2026-11-22");
    const monday = await seen(ana, st("2026-11-23T10:00"));
    expect(monday).toMatchObject({ kvk: [102], noted: [], equal: true });
    expect(monday.all).not.toContain(101);
  });

  it("links Insights' help list to the group only while someone is in it and the Follow-up tab is on", async () => {
    const now = st("2026-11-22T10:00");
    const ana = await signedIn("Ana", now);
    await reads("2026-11-18", "2026-11-21");
    await marks(ana);
    const link = async (access: WorkspaceAccess) =>
      (await insightsView(db, access, now, ZONE)).kvkFollowUp;
    expect(await link(ana)).toBe(true);
    // Both talked to: the group is empty (103 is under Needs help, 104 on a break), so no link.
    const talked = input(102);
    await recordFollowUp(db, ana, input(101), at(st("2026-11-22T09:00")));
    await recordFollowUp(db, ana, talked, at(st("2026-11-22T09:05")));
    expect(await link(ana)).toBe(false);
    // 102's talk undone: someone is in the group again, but no link with the Follow-up tab off (D126).
    const undo = { uid: 102, target: talked.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, at(st("2026-11-22T09:06")));
    expect(await link(ana)).toBe(true);
    const ws = await findWorkspaceBySlug(db, "ogs");
    await db.insert(workspaceFeatures).values({
      workspaceId: ws?.id ?? 0,
      switches: {},
      allianceSwitches: { follow_up: false },
    });
    expect(await link(await signedIn("Bo", now))).toBe(false);
  });
});
