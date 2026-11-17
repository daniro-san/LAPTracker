import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { notices } from "../schema-notices";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { saveNotice } from "./notices";
import { createSession } from "./session";

const NOW = new Date("2026-11-16T12:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
});

async function officer(): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

describe("a new notice saved twice (D100, ADV-12)", () => {
  it("is stored once when the retry carries the same request id", async () => {
    const ana = await officer();
    const changes = [{ field: "title" as const, value: "Saturday plan", version: 0 }];
    const id = randomUUID();
    const first = await saveNotice(db, ana, null, changes, NOW, id);
    expect(await saveNotice(db, ana, null, changes, NOW, id)).toEqual(first);
    expect(await db.select().from(notices)).toHaveLength(1);
    await saveNotice(db, ana, null, changes, NOW, randomUUID());
    expect(await db.select().from(notices)).toHaveLength(2);
  });
});
