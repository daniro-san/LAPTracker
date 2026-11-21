// Before the suite: a fresh e2e database (dropped and created again), the migrations through psql
// (scripts/db-local.mjs), the seed, and an empty outbound log. Local Postgres only.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { DATABASE_URL, OUTBOUND_LOG } from "./env";
import { seedSql } from "./fixtures/seed";

function run(command: string, args: string[], input?: string, env?: Record<string, string>) {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    // libpq would follow these to another server (as in scripts/db-local.mjs).
    env: { ...process.env, PGHOSTADDR: undefined, PGSERVICE: undefined, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`e2e setup: ${command} failed\n${result.stderr}`);
  }
}

export default function globalSetup() {
  // scripts/db-local.mjs checks the URL in full before it migrates; this keeps the drop off any other host.
  const url = new URL(DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !name.includes("e2e")) {
    throw new Error(
      "E2E_DATABASE_URL must be a local postgres:// URL whose database name contains e2e",
    );
  }
  const admin = new URL(url.href);
  admin.pathname = "/postgres";
  const psql = (target: string, sql: string) =>
    run("psql", [target, "-X", "-q", "-v", "ON_ERROR_STOP=1"], sql);
  psql(admin.href, `drop database if exists "${name}" with (force);\ncreate database "${name}";\n`);
  run("node", ["scripts/db-local.mjs", "migrate"], undefined, { DATABASE_URL: url.href });
  // The specs lay out their dates from this same moment (seededAt), so a run past server midnight agrees.
  const now = new Date();
  process.env.E2E_NOW = String(now.getTime());
  psql(url.href, seedSql(now));
  mkdirSync(dirname(OUTBOUND_LOG), { recursive: true });
  writeFileSync(OUTBOUND_LOG, "");
}
