import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { findBlockedKeys } from "@/lib/queries";
import { dailyReads, dailyRosters } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const at = (day: string) => new Date(`${day}T08:01:00Z`);
const get = (unionId: string, query: string) =>
  GET(request(`/api/alliances/${unionId}/history?${query}`), {
    params: Promise.resolve({ unionId }),
  });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  for (const [day, uids] of [
    ["2026-11-08", [1, 2]],
    ["2026-11-09", [1, 3]],
  ] as const) {
    await db.insert(dailyReads).values({ day, startedAt: at(day), status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId: 1,
      tag: "OGs",
      memberCount: uids.length,
      sourceUpdatedAt: at(day),
      isFresh: true,
      memberUids: [...uids],
      memberNames: uids.map((u) => `m${u}`),
      memberPower: uids.map(() => 10),
      memberKills: uids.map(() => 5),
    });
  }
});

describe("GET /api/alliances/[unionId]/history", () => {
  it("serves the contents of the card read at `at`, diffed against the previous roster, and 404 for any other time", async () => {
    holder.ctx = testContext(db).ctx;

    const res = await get("1", `at=${at("2026-11-09").toISOString()}`);
    const body = (await res.json()) as Record<string, { uid: number }[]>;

    expect(res.status).toBe(200);
    expect(body.joined?.map((m) => m.uid)).toEqual([3]);
    expect(body.left?.map((m) => m.uid)).toEqual([2]);
    expect(findBlockedKeys(body)).toEqual([]);
    expect((await get("1", "at=2026-11-09T08:00:00.000Z")).status).toBe(404);
    expect((await get("1", "at=nope")).status).toBe(400);
  });
});
