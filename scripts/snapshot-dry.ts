// `pnpm snapshot:dry --phase before|after`: one runSnapshot through the real adapters with fetch
// stubbed to serve fixtures/, an in-memory repo and the console logger. No network, no database,
// no quota. Every roster's updated_at is rewritten to 30 s ago, as a fresh /v1 pull would return.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ALLIANCES } from "../config/alliances";
import { runSnapshot } from "../lib/collector";
import { consoleLogger } from "../lib/logger";
import { createMemoryRepo } from "../lib/repo/memory";
import { internal, v1 } from "../lib/sources";

const phase = process.argv[process.argv.indexOf("--phase") + 1];
if (phase !== "before" && phase !== "after") {
  console.error("usage: pnpm snapshot:dry --phase before|after");
  process.exit(2);
}

// Hosts under .invalid cannot resolve, and fetch is replaced below anyway.
process.env.LAP_API_KEY = "lap_dry-run-placeholder";
process.env.LAP_API_BASE_URL = "https://v1.invalid/v1";
process.env.LAP_SITE_BASE_URL = "https://site.invalid/api";

const fixtures = join(import.meta.dirname, "../fixtures");
const read = (path: string) => readFileSync(join(fixtures, path), "utf8");

/** union_id → fixture body: fixtures/v1-ids/<id>.json, else the latest fixtures/v1-<ts>/alliance-<id>.json. */
const bodies = new Map<string, string>();
for (const dir of readdirSync(fixtures)
  .filter((d) => d.startsWith("v1-"))
  .sort()) {
  for (const file of readdirSync(join(fixtures, dir))) {
    const id = /^(?:alliance-)?(\d+)\.json$/.exec(file)?.[1];
    if (id) bodies.set(id, read(`${dir}/${file}`));
  }
}

const now = new Date();
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.pathname === "/v1/quota") return json(read("v1-20261104T154755Z/quota-before.json"));
  if (url.pathname.endsWith("/ranks")) return json(read("ranks-325-20261104T201831Z/ranks.json"));
  const id = /^\/v1\/alliances\/(\d+)$/.exec(url.pathname)?.[1];
  const body = id ? bodies.get(id) : undefined;
  if (!body) return json('{"detail":"alliance not found"}', 404);
  const roster = JSON.parse(body) as Record<string, unknown>;
  return json(JSON.stringify({ ...roster, updated_at: Math.floor(now.getTime() / 1000) - 30 }));
};

const repo = createMemoryRepo([{ id: 1, allianceIds: ALLIANCES.map((a) => a.unionId) }]);
const summary = await runSnapshot(1, phase, {
  v1,
  internal,
  repo,
  logger: consoleLogger,
  now: () => new Date(),
});

console.log("\nsummary", summary);
for (const { row, members } of repo.tables.rows.get(summary.snapshotId) ?? []) {
  const cells = [row.tag, row.source, row.isFresh ? "fresh" : "STALE", members.length];
  console.log(cells.join("\t"), row.totalPower, row.totalKills, row.error ?? "");
}
