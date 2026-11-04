// `pnpm db:migrate`: apply drizzle/ to the database behind DATABASE_URL_UNPOOLED (or DATABASE_URL).
// Vercel runs it before every build (vercel.json buildCommand), so each environment migrates its own
// Neon branch (plan §3.2).
//
// Why not drizzle's own migrators: drizzle-kit chose a WebSocket driver and died in Vercel's build
// container; drizzle-orm's neon-http migrator runs the statements one HTTP call at a time with no
// transaction, so a failure half-way left the preview branch with tables but no journal row (PR #19).
// This applies each migration as ONE non-interactive HTTP transaction — all of its statements plus
// its journal row — so a migration is either fully applied or not at all. Same journal table and
// hashing as drizzle (drizzle.__drizzle_migrations: hash = sha256 of the file, created_at = journal
// `when`), so drizzle's tools still agree on what has been applied.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";

type JournalEntry = { idx: number; when: number; tag: string };
type Journal = { entries: JournalEntry[] };

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("db:migrate: DATABASE_URL_UNPOOLED (or DATABASE_URL) is required");
  process.exit(2);
}

const sql = neon(url);
const folder = "drizzle";
const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")) as Journal;

await sql.query("CREATE SCHEMA IF NOT EXISTS drizzle");
await sql.query(
  "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
);
const last = (await sql.query(
  "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
)) as { created_at: string | number | null }[];
const lastAppliedAt = Number(last[0]?.created_at ?? 0);

const pending = journal.entries.filter((e) => e.when > lastAppliedAt);
if (pending.length === 0) {
  console.log(`db:migrate: nothing to apply (journal at ${lastAppliedAt})`);
  process.exit(0);
}

for (const entry of pending) {
  const file = readFileSync(join(folder, `${entry.tag}.sql`), "utf8");
  const statements = file
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hash = createHash("sha256").update(file).digest("hex");
  const started = Date.now();
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement)),
    sql.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [
      hash,
      entry.when,
    ]),
  ]);
  console.log(
    `db:migrate: applied ${entry.tag} (${statements.length} statements) in ${Date.now() - started} ms`,
  );
}
