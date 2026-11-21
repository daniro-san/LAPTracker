// member_facts reads against PGlite (D149): the newest version per member and field without reading every
// version, and the week's window with the version before it.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { memberFacts } from "../schema";
import { factHistorySince, latestFacts } from "./member-facts";
import { findWorkspaceBySlug, saveWorkspace } from "./workspaces";

const at = (iso: string) => new Date(iso);

let db: Db;
let a = 0;
let b = 0;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: 1, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: 2, slug: "bravo", discordGuildId: "3", leaderRoleIds: ["4"] });
  a = (await findWorkspaceBySlug(db, "alpha"))?.id ?? 0;
  b = (await findWorkspaceBySlug(db, "bravo"))?.id ?? 0;
});

const fact = (workspaceId: number, uid: number, field: string, version: number, when: string) => ({
  workspaceId,
  uid,
  field,
  version,
  value: version * 10,
  source: "officer" as const,
  writtenAt: at(when),
});

describe("member facts reads (D149)", () => {
  it("gives the newest version of each field of each member, of the workspace only, by member and field", async () => {
    await db
      .insert(memberFacts)
      .values([
        fact(a, 7, "squadMight", 1, "2026-11-01T00:00:00Z"),
        fact(a, 7, "squadMight", 2, "2026-11-02T00:00:00Z"),
        fact(a, 7, "zone", 1, "2026-10-01T00:00:00Z"),
        fact(a, -3, "notes", 1, "2026-11-03T00:00:00Z"),
        fact(a, -3, "notes", 2, "2026-11-04T00:00:00Z"),
        fact(b, 7, "squadMight", 5, "2026-11-05T00:00:00Z"),
      ]);
    const rows = await latestFacts(db, a);
    expect(rows.map((r) => [r.uid, r.field, r.version, r.value])).toEqual([
      [-3, "notes", 2, 20],
      [7, "squadMight", 2, 20],
      [7, "zone", 1, 10],
    ]);
    expect(rows[1]?.writtenAt).toEqual(at("2026-11-02T00:00:00Z"));
    expect(await latestFacts(db, 99)).toEqual([]);
  });

  it("reads the versions from `since` on and, for those members and fields only, the version before", async () => {
    await db
      .insert(memberFacts)
      .values([
        fact(a, 7, "squadMight", 1, "2026-11-01T00:00:00Z"),
        fact(a, 7, "squadMight", 2, "2026-11-08T00:00:00Z"),
        fact(a, 7, "squadMight", 3, "2026-11-10T00:00:00Z"),
        fact(a, 7, "adTech", 1, "2026-11-09T00:00:00Z"),
        fact(a, 8, "squadMight", 1, "2026-11-02T00:00:00Z"),
        fact(a, 7, "zone", 1, "2026-11-10T00:00:00Z"),
        fact(b, 7, "squadMight", 9, "2026-11-10T00:00:00Z"),
      ]);
    const rows = await factHistorySince(
      db,
      a,
      ["squadMight", "adTech"],
      at("2026-11-09T00:00:00Z"),
    );
    expect(rows.map((r) => [r.uid, r.field, r.version])).toEqual([
      [7, "adTech", 1],
      [7, "squadMight", 2],
      [7, "squadMight", 3],
    ]);
  });
});
