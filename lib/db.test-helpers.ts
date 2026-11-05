// Test-only: a real Postgres (PGlite, in-process WASM) migrated from drizzle/, cast to Db as the
// Neon driver's type (DECISIONS D19). One instance per test file; truncate between tests.
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./db";
import * as schema from "./schema";

export async function openTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: `${import.meta.dirname}/../drizzle` });
  return db as unknown as Db;
}

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(
    sql`truncate run_logs, member_snapshots, alliance_snapshots, snapshots, events, auth_attempts, app_errors restart identity cascade`,
  );
}
