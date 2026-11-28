// A member who joined in the last 7 days is worth a hello, with the join date as evidence (issue 828): left
// out once the 7 days have passed and while the member is on a break. Invented data only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { cardFormats } from "./member-card";
import { saveFacts } from "./member-facts";
import { membersView } from "./members";
import { reasonText } from "./members-sheet";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";
/** The newest read: Saturday 2026-11-14 23:37 ST, 2026-11-15T01:37Z. */
const JOINED = new Map([
  [1, "2026-11-11T12:00:00Z"],
  [2, "2026-11-07T12:00:00Z"],
  [3, "2026-11-12T12:00:00Z"],
]);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  const day = "2026-11-14";
  const at = new Date(`${day}T23:37:00-02:00`);
  await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
  const uids = [...JOINED.keys()];
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
        joined_at: JOINED.get(uid),
      })),
    },
  });
});

async function read(onBreak = false) {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "officer-ogs", "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  if (onBreak)
    await saveFacts(
      db,
      access,
      3,
      [{ field: "status", version: 0, value: "break", source: "officer" }],
      NOW,
    );
  const view = await membersView(db, access, NOW, ZONE);
  return (uid: number) => view.members.find((m) => m.uid === uid)?.reasons ?? [];
}

describe("a member who joined this week (issue 828)", () => {
  it("is listed with the join date when joined_at is within 7 days of the newest read", async () => {
    const reasons = await read();
    expect(reasons(1)).toEqual([{ kind: "joined", at: new Date("2026-11-11T12:00:00Z") }]);
    const [joined] = reasons(1);
    expect(
      reasonText(
        joined as NonNullable<typeof joined>,
        WORKSPACE_DICTIONARIES.en,
        cardFormats("en", ZONE, NOW),
      ),
    ).toBe("joined on Wed, Nov 11");
  });

  it("is not listed once 7 days have passed since joined_at", async () => {
    expect((await read())(2)).toEqual([]);
  });

  it("is never listed while the member is on a break", async () => {
    expect((await read(true))(3)).toEqual([]);
  });
});
