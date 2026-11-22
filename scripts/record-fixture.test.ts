// `pnpm fixture:record` spends upstream quota, so it makes no call unless FIXTURE_RECORD_CONFIRM=spend is set
// (CLAUDE.md: never spend quota unless the session allows it). The run is under e2e/no-network.mjs, so even a
// broken check could reach no outside host: the refused host would land in the outbound log.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
let dir = "";

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("pnpm fixture:record", () => {
  it("makes no upstream call and writes nothing without FIXTURE_RECORD_CONFIRM=spend", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-record-"));
    const outbound = join(dir, "outbound.log");
    const env = { ...process.env };
    delete env.FIXTURE_RECORD_CONFIRM;
    const result = spawnSync(
      join(ROOT, "node_modules/.bin/tsx"),
      ["--import", "./e2e/no-network.mjs", "scripts/record-fixture.ts"],
      {
        cwd: ROOT,
        input: `quota ${join(dir, "quota.json")}\n`,
        encoding: "utf8",
        env: { ...env, LAP_API_KEY: "lap_test-placeholder", E2E_OUTBOUND_LOG: outbound },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FIXTURE_RECORD_CONFIRM=spend");
    expect(existsSync(outbound)).toBe(false);
    expect(existsSync(join(dir, "quota.json"))).toBe(false);
  });
});
