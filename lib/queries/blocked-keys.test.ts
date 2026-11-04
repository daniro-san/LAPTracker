import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BLOCKED_ROSTER_KEYS, findBlockedKeys } from "./blocked-keys";

const queriesDir = import.meta.dirname;
const roster: unknown = JSON.parse(
  readFileSync(
    join(queriesDir, "../../fixtures/v1-20261104T155902Z/alliance-67111155.json"),
    "utf8",
  ),
);

/** Read-model sources: everything in lib/queries except the list itself and tests. */
const readModelFiles = readdirSync(queriesDir).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "blocked-keys.ts",
);

/** Matches a blocked key used as a property, a column name or a string literal. */
const usage = (key: string) => new RegExp(`(\\.${key}\\b|\\b${key}\\s*:|["'\`]${key}["'\`])`);

describe("BLOCKED_ROSTER_KEYS (plan §12.1)", () => {
  it("finds every blocked key in a real /v1 roster, so the detector is not vacuous", () => {
    const found = new Set(findBlockedKeys(roster).map((p) => p.split(".").at(-1)));
    for (const key of BLOCKED_ROSTER_KEYS) expect(found).toContain(key);
  });

  it("reports nothing for an object made only of served fields", () => {
    expect(
      findBlockedKeys({ members: [{ uid: 1, name: "a", power: 2, kills: 3, lv: 4 }] }),
    ).toEqual([]);
  });

  it("is referenced by no read model in lib/queries", () => {
    const offenders = readModelFiles.flatMap((file) => {
      const source = readFileSync(join(queriesDir, file), "utf8");
      return BLOCKED_ROSTER_KEYS.filter((key) => usage(key).test(source)).map(
        (key) => `${file}: ${key}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
