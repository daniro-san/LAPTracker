import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { insertFact } from "../repo/member-facts";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { factsOf, saveFacts, type FactChange } from "./member-facts";
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
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  for (const [unionId, uid] of [
    [OGS, 1],
    [NSE, 2],
  ] as const)
    await db.insert(dailyRosters).values({
      readDay: "2026-11-15",
      unionId,
      memberCount: 1,
      sourceUpdatedAt: NOW,
      isFresh: true,
      memberUids: [uid],
      memberNames: [`P${uid}`],
      memberPower: [1000],
      memberKills: [0],
    });
});

async function officer(slug: string, who: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, who, who, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

const write = (access: WorkspaceAccess, uid: number, ...changes: FactChange[]) =>
  saveFacts(db, access, uid, changes, NOW);

describe("member facts, edited by several officers (#297)", () => {
  it("appends each save as the field's next version, and refuses a stale edit with the newer value", async () => {
    const [ana, bea] = [await officer("ogs", "ana"), await officer("ogs", "bea")];
    await write(ana, 1, { field: "troopTier", version: 0, value: 8, source: "officer" });
    // Both opened the card at version 1; Ana saves first.
    const first = await write(ana, 1, {
      field: "troopTier",
      version: 1,
      value: 9,
      source: "officer",
    });
    const stale = await write(bea, 1, {
      field: "troopTier",
      version: 1,
      value: 7,
      source: "officer",
    });

    expect(first).toMatchObject([{ status: "saved", version: 2, value: 9 }]);
    expect(stale).toMatchObject([{ status: "conflict", version: 2, value: 9, source: "officer" }]);
    expect((await factsOf(db, ana)).get(1)?.troopTier).toEqual({
      value: 9,
      source: "officer",
      version: 2,
    });
  });

  it("combines notes and joins languages when two officers save the same field at once", async () => {
    const [ana, bea] = [await officer("ogs", "ana"), await officer("ogs", "bea")];
    await write(ana, 1, {
      field: "notes",
      version: 0,
      value: "Recruited by Zed",
      source: "officer",
    });
    await write(ana, 1, { field: "languages", version: 0, value: ["en"], source: "message" });
    await write(
      ana,
      1,
      { field: "notes", version: 1, value: "Recruited by Zed\nPrefers Discord", source: "officer" },
      { field: "languages", version: 1, value: ["en", "pt"], source: "officer" },
    );
    const late = await write(
      bea,
      1,
      { field: "notes", version: 1, value: "Recruited by Zed\nAway on Sundays", source: "officer" },
      { field: "languages", version: 1, value: ["en", "uk"], source: "officer" },
    );

    expect(late).toMatchObject([
      { status: "merged", value: "Recruited by Zed\nPrefers Discord\nAway on Sundays" },
      { status: "merged", value: ["en", "pt", "uk"] },
    ]);
  });

  it("reads stored languages in the app's order, so an editor opened on them starts unchanged", async () => {
    const ana = await officer("ogs", "ana");
    // As an old sheet import stored them: the sheet's order, not LANGUAGES order.
    await insertFact(db, {
      workspaceId: ana.workspaceId,
      uid: 1,
      field: "languages",
      version: 1,
      value: ["fr", "uk", "en"],
      source: "sheet",
      writtenBy: ana.user.id,
      writtenAt: NOW,
    });
    expect((await factsOf(db, ana)).get(1)?.languages?.value).toEqual(["en", "fr", "uk"]);
  });

  it("writes nothing for a member of another alliance, and one workspace never reads another's facts", async () => {
    const [ogs, nse] = [await officer("ogs", "ana"), await officer("nse", "cid")];
    await write(nse, 2, { field: "notes", version: 0, value: "NSE only", source: "officer" });

    expect(
      await write(ogs, 2, { field: "notes", version: 0, value: "x", source: "officer" }),
    ).toBeNull();
    expect((await factsOf(db, ogs)).size).toBe(0);
    expect((await factsOf(db, nse)).get(2)?.notes?.value).toBe("NSE only");
  });
});
