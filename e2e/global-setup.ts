// Before the suite: a fresh e2e database (dropped and created again), the migrations through psql
// (scripts/db-local.mjs) and the seed. Local Postgres only. The outbound log is not touched here: the
// servers are already running, and a refusal during their start must stay in it.
import { spawnSync } from "node:child_process";

import { BRIDGE_PORT, DATABASE_URL } from "./env";
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
  const url = new URL(DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.includes("e2e")) throw new Error("E2E_DATABASE_URL's database name must contain e2e");
  // Before the drop, scripts/db-local.mjs's full check: the host is localhost or 127.0.0.1 for every reader
  // of the URL (no host, hostaddr or service parameter), then that the bridge is listening.
  const local = { DATABASE_URL: url.href, DB_LOCAL_BRIDGE_PORT: String(BRIDGE_PORT) };
  run("node", ["scripts/db-local.mjs", "check"], undefined, local);
  const admin = new URL(url.href);
  admin.pathname = "/postgres";
  const psql = (target: string, sql: string) =>
    run("psql", [target, "-X", "-q", "-v", "ON_ERROR_STOP=1"], sql);
  psql(admin.href, `drop database if exists "${name}" with (force);\ncreate database "${name}";\n`);
  run("node", ["scripts/db-local.mjs", "migrate"], undefined, local);
  // The specs lay out their dates from this same moment (seededAt), so a run past server midnight agrees.
  const now = new Date();
  process.env.E2E_NOW = String(now.getTime());
  psql(url.href, seedSql(now));
}
