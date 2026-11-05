// Migration drift gate (plan §3.2), the last step of `pnpm check`: lib/schema.ts changed without a
// migration = red, then `drizzle-kit check` validates the journal. No DB connection.
// `drizzle-kit generate` writes into drizzle/ when it finds a change, so the gate puts drizzle/ back as it
// found it: a red check never leaves a stray migration in a dev tree.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "drizzle";

function readTree(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(path, readFileSync(path, "utf8"));
  }
  return files;
}

const before = readTree(DIR);
execFileSync("pnpm", ["exec", "drizzle-kit", "generate"], { stdio: "inherit" });
const after = readTree(DIR);

const created = [...after.keys()].filter((path) => !before.has(path));
const changed = [...before].filter(([path, body]) => after.get(path) !== body);
for (const path of created) rmSync(path);
for (const [path, body] of changed) writeFileSync(path, body);

if (created.length > 0 || changed.length > 0) {
  const touched = [...created, ...changed.map(([path]) => path)].join(", ");
  console.error(
    `Migration drift: lib/schema.ts has changes with no migration in ${DIR}/.\n` +
      `drizzle-kit generate wrote ${touched}; removed again. Run \`pnpm db:generate\` and commit the migration.`,
  );
  process.exit(1);
}

execFileSync("pnpm", ["exec", "drizzle-kit", "check"], { stdio: "inherit" });
