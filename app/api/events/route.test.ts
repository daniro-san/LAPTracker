import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { findOrCreateEvent } from "@/lib/repo/events";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

describe("GET /api/events", () => {
  it("serves events without isTest and with a 5-minute shared cache header", async () => {
    holder.ctx = testContext(db).ctx;
    await findOrCreateEvent(db, {
      name: "Saturday Event 2026-11-07",
      eventAtUtc: T0,
      beforeAt: T0,
      afterAt: T0,
    });

    const res = await GET(new Request("https://laptracker.test/api/events"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300");
    const { events } = (await res.json()) as { events: object[] };
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("isTest");
  });
});
