// A member's own days away on the Members tab and Follow-up (issue 829): left out while their days run, back
// once the last day has passed. The member's side is tested in me/away/route.test.ts. Invented data only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberSelfReports, workspaceUsers } from "../schema";
import { requireWorkspace } from "./access";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
});

/** Members 1 and 2 were last online 5 days before NOW: each has the "not seen" reason (issue 821). */
async function read() {
  const day = "2026-11-14";
  const at = new Date(`${day}T23:37:00-02:00`);
  await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
  const members = [1, 2].map((uid) => ({
    uid,
    nick_name: `P${uid}`,
    power: 1000,
    lv: 25,
    rank_code: 103,
    rank_label: "R3",
    last_online_at: "2026-11-11T12:00:00Z",
  }));
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: 2,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: [1, 2],
    memberNames: ["P1", "P2"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
    rawJson: { members },
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "officer-ogs", "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return membersView(db, access, NOW, ZONE);
}

/** Member 1's own days away, sent from the page of the user whose approved link is player 1. */
async function ownAway(days: { from: string; until: string }) {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const [user] = await db
    .insert(workspaceUsers)
    .values({
      workspaceId: ws?.id ?? 0,
      discordUserId: "member-1",
      displayName: "P1",
      playerUid: 1,
      playerLink: "approved",
    })
    .returning({ id: workspaceUsers.id });
  await db.insert(memberSelfReports).values({
    workspaceId: ws?.id ?? 0,
    userId: user?.id ?? 0,
    uid: 1,
    field: "away",
    value: days,
    version: 1,
    requestId: "req",
    writtenAt: NOW,
  });
}

const reasonsOf = (view: Awaited<ReturnType<typeof read>>, uid: number) =>
  view.members.find((m) => m.uid === uid)?.reasons.map((r) => r.kind);

describe("a member's own days away in Follow-up (issue 829)", () => {
  it("leaves a member out, the not-seen reason included, while their own days run", async () => {
    await ownAway({ from: "2026-11-15", until: "2026-11-18" });
    const view = await read();
    expect(reasonsOf(view, 1)).toEqual([]);
    expect(view.members.find((m) => m.uid === 1)?.awayUntil).toBe("2026-11-18");
    expect(reasonsOf(view, 2)).toEqual(["seen"]);
  });

  it("brings the reasons back once the last day has passed", async () => {
    await ownAway({ from: "2026-11-10", until: "2026-11-14" });
    expect(reasonsOf(await read(), 1)).toEqual(["seen"]);
  });
});
