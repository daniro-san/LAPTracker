import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import { BOARD_EXTRA, fakeInternal, fakeV1, IDS, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { LOOKUP_IP_LIMIT } from "@/lib/lookup";
import { claimTrackedSet, storeBoard } from "@/lib/repo/alliances";

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

  it("drops the public pages' shared reads after a read, so its roster shows at once (D143)", async () => {
    // Thursday 14:00 server time: no event running.
    const thu = new Date("2026-11-19T16:00:00Z");
    await storeBoard(db, "2026-11-19", await fakeInternal().fetchRanks(325));
    await claimTrackedSet(db, { day: "2026-11-19", allianceIds: IDS, source: "board" }, thu);
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = thu;
    ctx.v1 = fakeV1((id) => roster(id, new Date(thu.getTime() - 25 * 60_000)));
    const invalidate = vi.spyOn(ctx.publicCache, "invalidate");
    const ip = { ...OWN, "x-real-ip": "198.51.100.9" };

    const done = await press(ip);
    const taken = await press(ip);

    expect([done.status, taken.status]).toEqual([200, 409]);
    expect(invalidate).toHaveBeenCalledOnce();
  });
});
