// Migration 0034 (D105, amended 2026-11-17): a member session made under the old rule ("anyone in the
// server") is deleted, so it is not served once the owner sets a member role.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { saveWorkspace } from "../repo/workspaces";
import * as schema from "../schema";
import { requireBoard } from "./access";
import { createSession } from "./session";
import { jar, MEMBER_ROLE, R4 } from "./sign-in.test-helpers";

const DRIZZLE = `${import.meta.dirname}/../../drizzle`;

/** A copy of drizzle/ whose journal stops before 0034. */
function foldersBefore0034(): string {
  const dir = mkdtempSync(join(tmpdir(), "lap-0034-"));
  cpSync(DRIZZLE, dir, { recursive: true });
  const path = join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(path, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((e) => e.tag < "0034");
  writeFileSync(path, JSON.stringify(journal));
  return dir;
}

describe("migration 0034 (D105, amended 2026-11-17)", () => {
  it("deletes member sessions from before, so none is served after the role is set", async () => {
    const pg = drizzle({ client: new PGlite(), schema });
    await migrate(pg, { migrationsFolder: foldersBefore0034() });
    const db = pg as unknown as Db;
    await db.execute(sql`insert into workspaces (slug, union_id, discord_guild_id, leader_role_ids)
      values ('ogs', 67111155, '400000000000000001', ${`{${R4}}`})`);
    await db.execute(sql`insert into workspace_users (workspace_id, discord_user_id, display_name)
      values (1, '200000000000000002', 'Rio'), (1, '200000000000000001', 'Rook')`);
    const member = await createSession(db, 1, 1, T0, null, "member");
    const officer = await createSession(db, 1, 2, T0, null, "officer");

    await migrate(pg, { migrationsFolder: DRIZZLE });
    await saveWorkspace(db, {
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "400000000000000001",
      leaderRoleIds: [R4],
      memberRoleIds: [MEMBER_ROLE],
    });
    expect(await requireBoard(db, "ogs", jar(member.token), T0)).toEqual({
      ok: false,
      reason: "signed_out",
    });
    expect((await requireBoard(db, "ogs", jar(officer.token), T0)).ok).toBe(true);
  });
});
