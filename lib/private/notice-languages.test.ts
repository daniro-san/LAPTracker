import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { playerReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { countLanguages, memberLanguages } from "./notice-languages";
import { createSession } from "./session";

const OGS = 67111155;
const OTHER = 99999999;
const NOW = new Date("2026-11-28T12:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
});

async function officer(): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function roster(uids: number[]) {
  const at = new Date("2026-11-27T23:37:00Z");
  await db.insert(dailyReads).values({ day: "2026-11-27", startedAt: at, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-27",
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
    rawJson: { members: uids.map((uid) => ({ uid })) },
  });
}

const read = (uid: number, language: string | null, unionId = OGS) =>
  db.insert(playerReads).values({ unionId, uid, readAt: NOW, language });

describe("countLanguages", () => {
  it("counts per notice language, most first, and the rest as other", () => {
    expect(countLanguages(["en", "pt", "pt-BR", "fr", "en", "en", "es"], 9)).toEqual({
      read: 7,
      total: 9,
      counts: [
        { language: "en", n: 3 },
        { language: "pt-BR", n: 2 },
        { language: "fr", n: 1 },
      ],
      other: 1,
    });
  });
});

describe("memberLanguages", () => {
  it("leaves out members with no language read and says how many were read of the roster", async () => {
    await roster([1, 2, 3, 4]);
    await read(1, "en");
    await read(2, "pt");
    await read(3, null);
    const result = await memberLanguages(db, await officer(), NOW);
    expect(result).toMatchObject({ read: 2, total: 4, other: 0 });
    expect(result?.counts).toHaveLength(2);
  });

  it("reads the alliance's own player reads only", async () => {
    await roster([1, 2]);
    await read(1, "fr");
    await read(2, "en", OTHER);
    expect(await memberLanguages(db, await officer(), NOW)).toMatchObject({
      read: 1,
      counts: [{ language: "fr", n: 1 }],
    });
  });

  it("is null while no member has a language read", async () => {
    await roster([1]);
    await read(1, null);
    expect(await memberLanguages(db, await officer(), NOW)).toBeNull();
  });
});
