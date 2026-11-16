import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { cleanName, linkPlayer, profileView, renameOfficer, unlinkPlayer } from "./profile";
import { createSession } from "./session";

const OGS = 67111155;
const NSE = 67109944;
const NOW = new Date("2026-11-16T12:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
  await roster(OGS, "2026-11-15", { 11: "Kasoar•Thorne", 12: "LadyLi" });
  await roster(NSE, "2026-11-15", { 21: "Grimm" });
});

/** One alliance's daily roster: uid → name (D60). */
async function roster(unionId: number, day: string, names: Record<number, string>) {
  const uids = Object.keys(names).map(Number);
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => names[u] ?? ""),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
  });
}

/** The officer's access as the next page load reads it, after signing in with `discordName`. */
async function signedIn(slug: string, discordName: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, discordName, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

describe("the officer's display name (issue 334)", () => {
  it("is trimmed and must have 1 to 32 characters", () => {
    expect(cleanName("  Kasoar  ")).toBe("Kasoar");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("a".repeat(32))).toBe("a".repeat(32));
    expect(cleanName("a".repeat(33))).toBeNull();
    // Characters, not UTF-16 units: 32 emoji fit.
    expect(cleanName("🧶".repeat(32))).toBe("🧶".repeat(32));
  });

  it("is what the header shows, and the next sign-in keeps it", async () => {
    const access = await signedIn("ogs", "Kasoar (Discord)");
    expect(await renameOfficer(db, access, " ")).toBe("invalid_name");
    await renameOfficer(db, access, "  Kasoar ");
    const next = await signedIn("ogs", "Kasoar (Discord)");
    expect(next.user.displayName).toBe("Kasoar");
  });
});

describe('"This is me", between two workspaces (D71)', () => {
  it("suggests and links a player of the workspace's own alliance only, and unlinks", async () => {
    const ogs = await signedIn("ogs", "Kasoar");
    // The nickname is one part of the joined game name: the matcher's one match (D74).
    const view = await profileView(db, ogs);
    expect(view.suggestions).toEqual([{ uid: 11, name: "Kasoar•Thorne" }]);
    // The search's roster is OGs' own: NSE's player is not in it.
    expect(view.roster.map((p) => p.uid)).toEqual([11, 12]);
    // NSE's player is not in OGs' roster.
    expect(await linkPlayer(db, ogs, 21)).toBe("not_in_alliance");
    expect(await linkPlayer(db, ogs, 11)).toMatchObject({
      player: { uid: 11, name: "Kasoar•Thorne" },
    });
    expect((await signedIn("ogs", "Kasoar")).user.playerUid).toBe(11);
    // NSE's officer sees nothing of it.
    expect((await signedIn("nse", "Kasoar")).user.playerUid).toBeNull();

    const unlinked = await unlinkPlayer(db, await signedIn("ogs", "Kasoar"));
    expect(unlinked.player).toBeNull();
    expect((await signedIn("ogs", "Kasoar")).user.playerUid).toBeNull();
  });
});
