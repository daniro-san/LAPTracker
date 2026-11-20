import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import { BOARD_EXTRA } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { LOOKUP_IP_LIMIT } from "@/lib/lookup";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

const OWN = { origin: "https://laptracker.test", "content-type": "application/json" };
const press = (headers: Record<string, string>, unionId = String(BOARD_EXTRA[0])) =>
  POST(request(`/api/alliances/${unionId}/details`, { headers }), {
    params: Promise.resolve({ unionId }),
  });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

describe("POST /api/alliances/[unionId]/details (D133)", () => {
  it("takes only a same-origin JSON press, and at most a few from one address in 15 minutes", async () => {
    const { ctx } = testContext(db);
    holder.ctx = ctx;

    const crossSite = await press({ ...OWN, origin: "https://elsewhere.test" });
    const answers = [];
    for (let i = 0; i <= LOOKUP_IP_LIMIT; i++) answers.push((await press(OWN, "99")).status);

    expect(crossSite.status).toBe(403);
    // An alliance nobody knows is a 404 until the address's presses run out.
    expect(answers).toEqual([...Array(LOOKUP_IP_LIMIT).fill(404), 429]);
    expect(ctx.v1).toMatchObject({ calls: [] });
  });
});
