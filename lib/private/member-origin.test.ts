// Where a member came from (owner, 2026-11-20, issue 461; D136): from the daily rosters of every alliance
// we read and the alliance tag in the member's own history rows, the most recent first, with the day they
// joined us; unknown stays unknown. Invented alliances and members.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { playerHistory } from "../schema-squads";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { memberOrigin, originOf } from "./member-origin";
import { createSession } from "./session";

const OURS = 67111155;
const [FERN, MOSS, REED] = [70000001, 70000002, 70000003];
const NOW = new Date("2026-11-20T12:00:00Z");
const t = WORKSPACE_DICTIONARIES.en;

describe("where a member came from (issue 461)", () => {
  it("lists the alliances before ours, the most recent first, and the first day with us after the last one", () => {
    const origin = originOf(
      [
        { day: "2026-11-01", unionId: REED, tag: "RD" },
        { day: "2026-11-05", unionId: MOSS },
        { day: "2026-11-09", unionId: MOSS, tag: "MS" },
        { day: "2026-11-10", unionId: OURS },
        // A day seen in both: the move happened that day, so it still ends with us.
        { day: "2026-11-12", unionId: FERN, tag: "FN" },
        { day: "2026-11-12", unionId: OURS },
        { day: "2026-11-13", unionId: 0 },
        { day: "2026-11-14", unionId: OURS },
      ],
      OURS,
    );
    expect(origin).toEqual({
      before: [
        { unionId: FERN, tag: "FN" },
        { unionId: MOSS, tag: "MS" },
        { unionId: REED, tag: "RD" },
      ],
      joined: "2026-11-12",
    });
    // Only ever seen with us: nothing is known, and no join day is made up.
    expect(originOf([{ day: "2026-11-10", unionId: OURS }], OURS)).toEqual({
      before: [],
      joined: null,
    });
  });

  describe("from the stored reads", () => {
    let db: Db;
    beforeAll(async () => {
      db = await openTestDb();
    });
    beforeEach(async () => truncateAll(db));

    async function roster(day: string, unionId: number, tag: string, uids: number[]) {
      await db
        .insert(dailyReads)
        .values({ day, startedAt: NOW, status: "complete" })
        .onConflictDoNothing();
      await db.insert(dailyRosters).values({
        readDay: day,
        unionId,
        tag,
        name: `${tag} Hall`,
        memberCount: uids.length,
        sourceUpdatedAt: NOW,
        isFresh: true,
        memberUids: uids,
        memberNames: uids.map((u) => `P${u}`),
        memberPower: uids.map(() => 1000),
        memberKills: uids.map(() => 0),
      });
    }

    it("reads both sources, names the alliance from its roster, and says not known when nothing is", async () => {
      await saveWorkspace(db, {
        unionId: OURS,
        slug: "ogs",
        discordGuildId: "1",
        leaderRoleIds: ["2"],
      });
      await roster("2026-11-16", FERN, "FN", [101]);
      await roster("2026-11-17", OURS, "OG", [101, 102]);
      // An older alliance only the member's own history knows, with the tag it had then.
      await db.insert(playerHistory).values({
        unionId: OURS,
        uid: 101,
        t: new Date("2026-11-02T10:00:00Z"),
        playerUnionId: MOSS,
        unionAbbr: "MS",
      });
      const ws = await findWorkspaceBySlug(db, "ogs");
      const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
      const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
      const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
      if (!access.ok) throw new Error("no access");
      const lines = (uid: number) => memberOrigin(db, access, uid, "Etc/GMT+2", t, (d) => d);
      expect(await lines(101)).toEqual([
        "Came from ⁨[FN] FN Hall⁩ · joined us 2026-11-17",
        "Before that: ⁨[MS]⁩",
      ]);
      expect(await lines(102)).toEqual(["Came from: not known"]);
    });
  });
});
