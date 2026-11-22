import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { appErrors } from "../schema";
import { accessRequests } from "../schema-invites";
import { countErrorsSince, errorsSlug, listErrorGroups } from "./admin-errors";
import { countWaitingRequests } from "./alliance-invites";

// Sun 22 Nov 2026, 11:20 UTC (09:20 ST).
const NOW = new Date("2026-11-22T11:20:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const error = (at: Date, digest: string, workspaceSlug: string | null) => ({
  at,
  route: "/w/[slug]/roll-call",
  digest,
  message: "roll_call_conflict",
  workspaceSlug,
});

describe("/admin/errors (issue 585, F34)", () => {
  it("gives each group the workspace addresses it happened under, and with ?w= that workspace's groups only", async () => {
    await db
      .insert(appErrors)
      .values([
        error(ago(3), "d1a2", "amber"),
        error(ago(5), "d1a2", "birch"),
        error(ago(30), "d1a2", "amber"),
        error(ago(26), "e9f1", "birch"),
        error(ago(50), "b210", null),
      ]);

    const all = await listErrorGroups(db);
    expect(all.map((g) => [g.digest, g.count, g.workspaces])).toEqual([
      ["d1a2", 3, ["amber", "birch"]],
      ["e9f1", 1, ["birch"]],
      ["b210", 1, []],
    ]);
    const amber = await listErrorGroups(db, "amber");
    expect(amber.map((g) => [g.digest, g.count, g.workspaces])).toEqual([["d1a2", 2, ["amber"]]]);
  });

  it("takes ?w= only as one workspace address; anything else lists every error", () => {
    expect(errorsSlug("amber")).toBe("amber");
    expect(errorsSlug(["amber", "birch"])).toBeUndefined();
    expect(errorsSlug("<b>x</b>")).toBeUndefined();
    expect(errorsSlug("invite")).toBeUndefined();
    expect(errorsSlug(undefined)).toBeUndefined();
  });

  it("counts the app errors of the last 24 h for the nav, not older ones", async () => {
    await db
      .insert(appErrors)
      .values([
        error(ago(1), "d1a2", "amber"),
        error(ago(23.9), "e9f1", null),
        error(ago(24.1), "b210", null),
      ]);
    expect(await countErrorsSince(db, ago(24))).toBe(2);
  });
});

describe("countWaitingRequests (issue 585, F11)", () => {
  it("counts every request with no answer yet, also past the 50 /admin lists", async () => {
    const request = (i: number) => ({
      unionId: 910103,
      playerName: `Juniper Vale ${i}`,
      claimedRole: "r4" as const,
      rosterMatch: "found" as const,
      rosterRank: "R4",
      statusHash: `hash-${i}`,
      createdAt: ago(i),
    });
    await db
      .insert(accessRequests)
      .values([
        ...Array.from({ length: 52 }, (_, i) => request(i)),
        { ...request(60), decision: "approved" as const, decidedAt: ago(1) },
        { ...request(61), decision: "declined" as const, decidedAt: ago(1) },
      ]);
    expect(await countWaitingRequests(db)).toBe(52);
  });
});
