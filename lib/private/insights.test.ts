// Issue 489: the Insights page's read from PGlite: our end-of-day rosters, another alliance's daily rosters
// and our members' /v1/players history rows for where people came from and went, a member on a break left
// out of the effort comparison, and none of the roster's private fields in the view. Invented values only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "../schema";
import { playerHistory } from "../schema-squads";
import { requireWorkspace } from "./access";
import { insightsView } from "./insights";
import { createSession } from "./session";

const OURS = 67111155;
const [FERN, MOSS] = [70000001, 70000002];
const NOW = new Date("2026-11-20T12:00:00Z");
const ZONE = "Etc/GMT+2";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

async function roster(day: string, unionId: number, uids: number[], raw = false) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: unionId === FERN ? "FN" : "OG",
    name: unionId === FERN ? "Fern Hall" : "Our Hall",
    memberCount: uids.length,
    sourceUpdatedAt: NOW,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => u * 100_000),
    memberKills: uids.map(() => 0),
    ...(raw && {
      rawJson: {
        members: uids.map((uid) => ({
          uid,
          nick_name: `P${uid}`,
          power: uid * 100_000,
          active: 500,
          daily_honor: 1000,
          daily_tech: 4000,
          x: 98765,
          y: 54321,
          last_online_at: 1763337600,
        })),
      },
    }),
  });
}

describe("the Insights read (issue 489)", () => {
  it("finds where joiners came from and leavers went, leaves a member on a break out, and shows no private field", async () => {
    await saveWorkspace(db, {
      unionId: OURS,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
    });
    await roster("2026-11-14", FERN, [104]);
    await roster("2026-11-16", OURS, [101, 102, 103, 105, 106, 107], true);
    await roster("2026-11-17", OURS, [101, 102, 104, 105, 106, 107], true);
    await roster("2026-11-18", OURS, [101, 102, 104, 105, 106, 107, 108], true);
    await roster("2026-11-18", FERN, [103]);
    // 108 came from an alliance only its own history row names.
    await db.insert(playerHistory).values({
      unionId: OURS,
      uid: 108,
      t: new Date("2026-11-17T10:00:00Z"),
      playerUnionId: MOSS,
      unionAbbr: "MS",
    });
    const ws = await findWorkspaceBySlug(db, "ogs");
    const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
    await db.insert(memberFacts).values({
      workspaceId: ws?.id ?? 0,
      uid: 102,
      field: "status",
      version: 1,
      value: "break",
      source: "officer",
      writtenBy: userId,
      writtenAt: NOW,
    });
    const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no access");

    const view = await insightsView(db, access, NOW, ZONE);
    expect(view.flow?.cameFrom).toEqual([
      { unionId: FERN, tag: null, n: 1 },
      { unionId: MOSS, tag: "MS", n: 1 },
    ]);
    expect(view.flow?.wentTo).toEqual([{ unionId: FERN, tag: null, n: 1 }]);
    expect(view.labels.get(FERN)).toMatchObject({ tag: "FN", name: "Fern Hall" });
    // 102 is on a break; 104 and 108 were first seen after our first read, so they are new.
    expect(view.effort?.leftOut).toEqual({ fresh: 2, away: 1, noMight: 0 });
    expect(view.effort?.members).toBe(4);
    expect(JSON.stringify(view)).not.toMatch(/98765|54321|1763337600|last_?online/);
  });
});
