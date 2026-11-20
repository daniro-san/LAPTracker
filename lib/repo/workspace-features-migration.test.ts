// Migration 0057 (D134): each daily cap the owner had set moves from its column into the `caps` map, and a
// cap that was not set (null) is left out, so it follows the defaults. Rows seeded under the 0056 schema.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

import type { Db } from "../db";
import * as schema from "../schema";

const DRIZZLE = `${import.meta.dirname}/../../drizzle`;

/** A copy of drizzle/ whose journal stops before 0057. */
function foldersBefore0057(): string {
  const dir = mkdtempSync(join(tmpdir(), "lap-0057-"));
  cpSync(DRIZZLE, dir, { recursive: true });
  const path = join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(path, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((e) => e.tag < "0057");
  writeFileSync(path, JSON.stringify(journal));
  return dir;
}

describe("migration 0057 (D134)", () => {
  it("moves each cap that was set into the caps map, and leaves out the ones that were not", async () => {
    const pg = drizzle({ client: new PGlite(), schema });
    await migrate(pg, { migrationsFolder: foldersBefore0057() });
    const db = pg as unknown as Db;
    // Invented alliances, under the 0056 columns (ai_per_day, translate_per_day).
    await db.execute(sql`insert into workspaces (slug, union_id, discord_guild_id, leader_role_ids)
      values ('ogs', 67111155, '1', '{2}'), ('wolf', 900001, '3', '{4}'), ('fox', 900002, '5', '{6}')`);
    await db.execute(sql`insert into workspace_features
      (workspace_id, switches, ai_per_day, translate_per_day)
      values (1, '{}', null, null), (2, '{"thefts": false}', 40, null), (3, '{}', 0, 15)`);

    await migrate(pg, { migrationsFolder: DRIZZLE });
    const rows = await db.execute<{ workspace_id: number; switches: unknown; caps: unknown }>(
      sql`select workspace_id, switches, caps from workspace_features order by workspace_id`,
    );
    expect(rows.rows).toEqual([
      { workspace_id: 1, switches: {}, caps: {} },
      { workspace_id: 2, switches: { thefts: false }, caps: { ai: 40 } },
      { workspace_id: 3, switches: {}, caps: { ai: 0, translate: 15 } },
    ]);
  }, 60_000); // Two full migration runs on PGlite; slow when the machine is busy.
});
