// Test-only: a real Postgres (PGlite, in-process WASM) migrated from drizzle/, cast to Db as the
// Neon driver's type (docs/decisions/D19). One instance per test file; truncate between tests.
// The migrated, seeded database is built once and saved to the OS temp dir (testDbSnapshot); each
// openTestDb loads its own in-memory copy of that file.
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./db";
import * as schema from "./schema";
import { alliances } from "./schema-alliances";

const ROOT = `${import.meta.dirname}/..`;
const MIGRATIONS = `${ROOT}/drizzle`;
const FIXTURE = `${ROOT}/fixtures/ranks-325-20261104T201831Z/ranks.json`;

/**
 * The alliances' labels as the fixture ranks board names them (D133): every test database starts as if the
 * board had been read once, so a workspace's alliance has its tag. truncateAll keeps them.
 */
async function seedBoardLabels(db: Db): Promise<void> {
  const body = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
    boards: { slug: string; rows: { id: number; abbr: string; name: string }[] }[];
  };
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

/**
 * The path of a tarball of a freshly migrated and seeded database, built on first use. Its name hashes
 * everything that shapes it (the migrations, the fixture, the seed's schema module, this file, the PGlite and drizzle-orm pins), so
 * a new or edited migration gets a new file and a file built from other inputs is never read. It is
 * written under a temp name and renamed, so parallel workers and other checkouts never read half a file.
 * vitest.global-setup.ts builds it once before the workers start.
 */
export async function testDbSnapshot(): Promise<string> {
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const hash = createHash("sha256").update(
    `pglite ${pkg.devDependencies["@electric-sql/pglite"]} drizzle-orm ${pkg.dependencies["drizzle-orm"]}`,
  );
  const sqlFiles = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of sqlFiles) hash.update(f).update(readFileSync(`${MIGRATIONS}/${f}`));
  // The seed inserts through lib/schema-alliances.ts: a column change there without a migration rebuilds too.
  const seedSchema = `${ROOT}/lib/schema-alliances.ts`;
  for (const f of [`${MIGRATIONS}/meta/_journal.json`, FIXTURE, seedSchema, import.meta.filename])
    hash.update(readFileSync(f));
  const dir = join(tmpdir(), "laptracker-test-db");
  const path = join(dir, `${hash.digest("hex").slice(0, 16)}.tar`);
  if (existsSync(path)) return path;

  const pg = new PGlite();
  const db = drizzle({ client: pg, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await seedBoardLabels(db as unknown as Db);
  const tar = new Uint8Array(await (await pg.dumpDataDir("none")).arrayBuffer());
  await pg.close();
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, tar);
  renameSync(tmp, path);
  return path;
}

export async function openTestDb(): Promise<Db> {
  const tar = readFileSync(await testDbSnapshot());
  const db = drizzle({ client: new PGlite({ loadDataDir: new Blob([tar]) }), schema });
  return db as unknown as Db;
}

/** Empties the tables tests write, the site-wide feature defaults and pauses (D134) included. */
export async function truncateAll(db: Db): Promise<void> {
  await db.execute(
    sql`truncate workspace_sessions, workspace_users, workspaces, player_frames, daily_rosters, daily_reads, run_logs, member_snapshots, alliance_snapshots, snapshots, events, auth_attempts, app_errors, app_alerts, tick_log, member_squads, player_reads, player_history, hero_catalog, workspace_tombstones, access_requests, alliance_invites, alliance_board, tracked_sets, alliance_lookups, feature_defaults, allowance_pauses restart identity cascade`,
  );
}

/** A database that fails the test on any query: what "asks the database nothing" checks (D141). */
export const noQueryDb = new Proxy({} as Db, {
  get() {
    throw new Error("queried the database");
  },
});
