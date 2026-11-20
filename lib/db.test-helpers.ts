// Test-only: a real Postgres (PGlite, in-process WASM) migrated from drizzle/, cast to Db as the
// Neon driver's type (docs/decisions/D19). One instance per test file; truncate between tests.
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./db";
import * as schema from "./schema";
import { alliances } from "./schema-alliances";

/**
 * The alliances' labels as the fixture ranks board names them (D133): every test database starts as if the
 * board had been read once, so a workspace's alliance has its tag. truncateAll keeps them.
 */
async function seedBoardLabels(db: Db): Promise<void> {
  const body = JSON.parse(
    readFileSync(
      `${import.meta.dirname}/../fixtures/ranks-325-20261104T201831Z/ranks.json`,
      "utf8",
    ),
  ) as { boards: { slug: string; rows: { id: number; abbr: string; name: string }[] }[] };
  const rows = body.boards.find((b) => b.slug === "alliance_power")?.rows ?? [];
  await db.insert(alliances).values(
    rows.map((r) => ({
      unionId: r.id,
      tag: r.abbr || null,
      name: r.name || null,
      firstSeenDay: "2026-11-04",
      lastSeenDay: "2026-11-04",
    })),
  );
}

export async function openTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: `${import.meta.dirname}/../drizzle` });
  await seedBoardLabels(db as unknown as Db);
  return db as unknown as Db;
}

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(
    sql`truncate workspace_sessions, workspace_users, workspaces, player_frames, daily_rosters, daily_reads, run_logs, member_snapshots, alliance_snapshots, snapshots, events, auth_attempts, app_errors, app_alerts, tick_log, member_squads, player_reads, player_history, hero_catalog, workspace_tombstones, access_requests, alliance_invites, alliance_board, tracked_sets, alliance_lookups restart identity cascade`,
  );
}
