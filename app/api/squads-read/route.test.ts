import { describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, testContext } from "@/lib/app-context.test-helpers";
import { noQueryDb } from "@/lib/db.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

describe("POST /api/squads-read", () => {
  it("answers 204 and asks the database nothing before the quota day's read (D141)", async () => {
    const { ctx, clock } = testContext(noQueryDb);
    clock.now = new Date("2026-11-19T00:30:00Z"); // Wednesday 22:30 ST: the day's read is at 23:30
    holder.ctx = ctx;

    const res = await POST(
      request("/api/squads-read", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
    );

    expect(res.status).toBe(204);
  });
});
