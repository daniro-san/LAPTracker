import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { followUpsOf, followUpView, recordFollowUp, type FollowUpInput } from "./follow-up";
import { saveFacts } from "./member-facts";
import { createSession } from "./session";

const OGS = 67111155;
/** Friday 20 Nov; the server's clock (SERVER_TZ) is UTC−2, so the week is Mon 16 – Sun 22 Nov. */
const NOW = new Date("2026-11-20T12:00:00Z");
const CLOCK = { now: NOW, zone: "Etc/GMT+2" };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** An end-of-day read: uid → weekly activity, with nothing donated. */
async function endOfDay(day: string, members: Record<number, number>) {
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
        daily_tech: 0,
        active: members[uid],
      })),
    },
  });
}

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // 101 holds still for three reads (the offline proxy, D75); 102 grows; 103 joins on the 18th (new).
  await endOfDay("2026-11-17", { 101: 5, 102: 10 });
  await endOfDay("2026-11-18", { 101: 5, 102: 20, 103: 1 });
  await endOfDay("2026-11-19", { 101: 5, 102: 30, 103: 2 });
});

async function signedIn(name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
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

const listed = async (access: WorkspaceAccess) =>
  (await followUpView(db, access, NOW, CLOCK.zone)).items.map((i) => [
    i.member.uid,
    i.checkIn,
    i.toAsk,
  ]);

describe("the Follow-up list (issue 340, D104)", () => {
  it("holds Check in and new members with onboarding facts missing; a record takes them off", async () => {
    const ana = await signedIn("Ana");
    expect(await listed(ana)).toEqual([
      [101, true, []],
      [103, false, ["squadMight", "adTech", "timeZone"]],
    ]);
    const done = await recordFollowUp(db, ana, input(101, { note: "Busy at work" }), CLOCK);
    expect(done).toEqual({ ok: true });
    expect(await listed(ana)).toEqual([[103, false, ["squadMight", "adTech", "timeZone"]]]);
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
});
