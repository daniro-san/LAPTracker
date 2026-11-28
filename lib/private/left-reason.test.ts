// Why a former member left (issue 469): a reason and note saved as the fact `leftReason`, a correction as
// its next version, a stale save refused with the newer reason, and the monthly counts by reason. Invented
// names.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { factHistory } from "../repo/member-facts";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { formerMembers, type FormerMember } from "./former-members";
import { leftByMonth, saveLeftReason } from "./left-reason";
import { createSession } from "./session";

const UNION = 67111155;
const ZONE = "Etc/GMT+2";
const NOW = new Date("2026-11-27T12:00:00Z");

let db: Db;
let ana: WorkspaceAccess;

async function read(day: string, members: [number, string][]) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: UNION,
    memberCount: members.length,
    sourceUpdatedAt: new Date(`${day}T12:00:00Z`),
    isFresh: true,
    memberUids: members.map(([uid]) => uid),
    memberNames: members.map(([, name]) => name),
    memberPower: members.map(() => 1000),
    memberKills: members.map(() => 10),
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: UNION,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  ana = access;
  await read("2026-11-20", [
    [21, "Wren"],
    [22, "Ilsa"],
  ]);
  await read("2026-11-26", [[21, "Wren"]]);
});

describe("why a former member left (issue 469)", () => {
  it("saves a reason and note for a former member only, and the view reads it back", async () => {
    const change = { version: 0, reason: "otherAlliance" as const, note: "moved to a friend" };

    expect(await saveLeftReason(db, ana, 22, change, NOW)).toEqual({
      status: "saved",
      version: 1,
      value: { reason: "otherAlliance", note: "moved to a friend" },
    });
    // A member of the newest roster and a uid no roster listed get none.
    expect(await saveLeftReason(db, ana, 21, change, NOW)).toBeNull();
    expect(await saveLeftReason(db, ana, 99, change, NOW)).toBeNull();
    const [ilsa] = await formerMembers(db, ana, ZONE);
    expect(ilsa?.facts.leftReason).toMatchObject({
      value: { reason: "otherAlliance", note: "moved to a friend" },
      version: 1,
      source: "officer",
    });
  });

  it("keeps a correction as a new version and refuses a stale save with the newer reason", async () => {
    await saveLeftReason(db, ana, 22, { version: 0, reason: "left", note: "" }, NOW);
    const corrected = { version: 1, reason: "inactive" as const, note: "no log-in for weeks" };

    expect(await saveLeftReason(db, ana, 22, corrected, NOW)).toMatchObject({
      status: "saved",
      version: 2,
    });
    expect(
      await saveLeftReason(db, ana, 22, { version: 1, reason: "removed", note: "" }, NOW),
    ).toEqual({
      status: "conflict",
      version: 2,
      value: { reason: "inactive", note: "no log-in for weeks" },
    });
    // A stale save of the very value saved since is no conflict, whatever key order jsonb returns.
    expect(await saveLeftReason(db, ana, 22, { ...corrected, version: 1 }, NOW)).toEqual({
      status: "saved",
      version: 2,
      value: { reason: "inactive", note: "no log-in for weeks" },
    });
    const history = await factHistory(db, ana.workspaceId, ["leftReason"], 22);
    expect(history.map((r) => [r.version, r.value])).toEqual([
      [1, { reason: "left", note: "" }],
      [2, { reason: "inactive", note: "no log-in for weeks" }],
    ]);
  });

  it("counts former members by the month they were last seen and by reason, none saved as Unknown", () => {
    const m = (uid: number, lastSeen: string, reason?: "left" | "removed"): FormerMember => ({
      uid,
      name: `Invented ${uid}`,
      lastSeen,
      might: null,
      kills: null,
      duel: null,
      facts: reason
        ? { leftReason: { value: { reason, note: "" }, source: "officer", version: 1 } }
        : {},
    });

    const months = leftByMonth([
      m(1, "2026-11-20", "left"),
      m(2, "2026-11-02"),
      m(3, "2026-10-30", "removed"),
      m(4, "2026-11-25", "left"),
    ]);

    expect(months).toEqual([
      {
        month: "2026-11",
        total: 3,
        counts: { left: 2, otherAlliance: 0, removed: 0, inactive: 0, unknown: 1 },
      },
      {
        month: "2026-10",
        total: 1,
        counts: { left: 0, otherAlliance: 0, removed: 1, inactive: 0, unknown: 0 },
      },
    ]);
    expect(JSON.stringify(months)).not.toContain("Invented");
  });
});
