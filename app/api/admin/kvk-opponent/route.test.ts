// /admin's KvK opponent (D152): PIN only; the next scheduled event's server and tags, checked as one path
// segment each; the result. Invented tags of an invented server 326.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { kvkOpponents } from "@/lib/schema-kvk";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

const NEXT = "2026-11-28T14:00:00.000Z"; // Sat 12:00 ST, the next KvK
const save = (body: unknown, pin: string | null = TEST_PIN) =>
  POST(
    new Request("https://laptracker.test/api/admin/kvk-opponent", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", ...(pin && { "x-edit-pin": pin }) },
      body: JSON.stringify(body),
    }),
  );

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db);
  test.clock.now = new Date("2026-11-26T18:00:00Z"); // Thu 16:00 ST
  holder.ctx = test.ctx;
});

describe("POST /api/admin/kvk-opponent (D152)", () => {
  it("saves the next KvK's server and tags, duplicates dropped case-sensitively, order kept", async () => {
    const res = await save({
      event_at: NEXT,
      server: 326,
      tags: ["AAA", "abc", "ABC", "AAA", "Берс"],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      event_at: NEXT,
      server: 326,
      tags: ["AAA", "abc", "ABC", "Берс"],
      result: null,
    });
    const [row] = await db.select().from(kvkOpponents);
    expect(row).toMatchObject({ server: 326, tags: ["AAA", "abc", "ABC", "Берс"] });
  });

  it("refuses 16 tags, a tag that leaves its path segment, our own server, and stores nothing", async () => {
    const many = Array.from({ length: 16 }, (_, i) => `T${i}`);
    for (const body of [
      { event_at: NEXT, server: 326, tags: many },
      { event_at: NEXT, server: 326, tags: [".."] },
      { event_at: NEXT, server: 326, tags: ["A/B"] },
      { event_at: NEXT, server: 326, tags: ["A B"] },
      { event_at: NEXT, server: 326, tags: ["THIRTEENCHARS"] },
      { event_at: NEXT, server: 325, tags: ["AAA"] },
      { event_at: NEXT, server: 0, tags: ["AAA"] },
    ])
      expect((await save(body)).status).toBe(400);
    expect((await save({ event_at: NEXT, server: 9999, tags: many.slice(0, 15) })).status).toBe(
      200,
    );
    expect(await db.select().from(kvkOpponents)).toHaveLength(1);
  });

  it("answers 404 for a date that is not an offered KvK, and 401 without the PIN", async () => {
    const res = await save({ event_at: "2026-11-29T14:00:00.000Z", server: 326, tags: ["AAA"] });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_a_kvk" });
    expect((await save({ event_at: NEXT, server: 326, tags: ["AAA"] }, null)).status).toBe(401);
    expect(await db.select().from(kvkOpponents)).toEqual([]);
  });

  it("records the result, and clears it again, for a KvK with an opponent", async () => {
    expect((await save({ event_at: NEXT, result: "lost" })).status).toBe(404);
    await save({ event_at: NEXT, server: 326, tags: ["AAA"] });
    expect(await (await save({ event_at: NEXT, result: "lost" })).json()).toMatchObject({
      result: "lost",
    });
    expect(await (await save({ event_at: NEXT, result: null })).json()).toMatchObject({
      result: null,
    });
  });
});
