import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ACTIVITY_KEYS, BLOCKED_ROSTER_KEYS, findBlockedKeys } from "./blocked-keys";

const queriesDir = import.meta.dirname;
const roster: unknown = JSON.parse(
  readFileSync(
    join(queriesDir, "../../fixtures/v1-20261104T155902Z/alliance-67111155.json"),
    "utf8",
  ),
);
/** A live roster, the read that carries `last_seen_at` (D163). */
const live: unknown = JSON.parse(
  readFileSync(
    join(queriesDir, "../../fixtures/probe-67110320-20261104T153605Z/01-before.json"),
    "utf8",
  ),
);

/** Read-model sources: everything in lib/queries except the list itself and tests. */
const readModelFiles = readdirSync(queriesDir).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "blocked-keys.ts",
);

/** The one read model that may name the activity keys: the public alliance page (D76 amendment 2026-11-28). */
const ACTIVITY_READ_MODEL = "alliance-page.ts";

/** Matches a blocked key used as a property, a column name or a string literal. */
const usage = (key: string) => new RegExp(`(\\.${key}\\b|\\b${key}\\s*:|["'\`]${key}["'\`])`);

describe("BLOCKED_ROSTER_KEYS (plan §12.1)", () => {
  it("finds every blocked key in a real /v1 roster or live roster, so the detector is not vacuous", () => {
    const found = new Set(findBlockedKeys([roster, live]).map((p) => p.split(".").at(-1)));
    for (const key of BLOCKED_ROSTER_KEYS) expect(found).toContain(key);
  });

  it("blocks last_seen_at, as CLAUDE.md's roster-fields rule names it (D163)", () => {
    expect(findBlockedKeys({ members: [{ uid: 1, last_seen_at: 1 }] })).toEqual([
      "members.0.last_seen_at",
    ]);
  });

  it("reports the activity keys unless the alliance page's read model allows them", () => {
    const row = { members: [{ uid: 1, active: 5, daily_honor: 1000, daily_tech: 2 }] };
    expect(findBlockedKeys(row)).toEqual([
      "members.0.active",
      "members.0.daily_honor",
      "members.0.daily_tech",
    ]);
    expect(findBlockedKeys(row, { allowActivity: true })).toEqual([]);
  });

  it("reports nothing for an object made only of served fields", () => {
    expect(
      findBlockedKeys({ members: [{ uid: 1, name: "a", power: 2, kills: 3, lv: 4 }] }),
    ).toEqual([]);
  });

  it("is referenced by no read model in lib/queries", () => {
    const offenders = readModelFiles.flatMap((file) => {
      const source = readFileSync(join(queriesDir, file), "utf8");
      const keys = [...BLOCKED_ROSTER_KEYS, ...(file === ACTIVITY_READ_MODEL ? [] : ACTIVITY_KEYS)];
      return keys.filter((key) => usage(key).test(source)).map((key) => `${file}: ${key}`);
    });
    expect(
      offenders,
      "Plan §12.1: a read model in lib/queries names a key from BLOCKED_ROSTER_KEYS (or ACTIVITY_KEYS outside alliance-page.ts). Remove it: those fields stay in raw_json, and the workspace reads them only through lib/private (D71).",
    ).toEqual([]);
  });
});
