// The tick's daily jobs after the day's first read (lib/tick.ts): D115's app_errors past 30 days are
// deleted, and D132's player reads keep their columns but lose raw bodies past 90 days.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, testContext } from "@/lib/app-context.test-helpers";
import { ago, fakeV1, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { appErrors } from "@/lib/schema";
import { playerReads } from "@/lib/schema-squads";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The squads batch after the answer (`after`) needs a Next request: not run here.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));

const { POST } = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** Sun 8 Nov 23:37 ST: the day's first read. */
const NOW = new Date("2026-11-09T01:37:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

/** The tick at NOW, every roster read; its answer as "day status". */
async function nightRead() {
  const { ctx, clock } = testContext(db);
  holder.ctx = ctx;
  clock.now = NOW;
  ctx.v1 = fakeV1((id) => roster(id, ago(clock.now, minutes(1))));
  const res = await POST(
    request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
  );
  const body = (await res.json()) as { day: string; status: string };
  return `${body.day} ${body.status}`;
}

describe("the tick's daily jobs after the day's first read", () => {
  it("deletes app_errors rows older than 30 days (D115, 2026-11-21)", async () => {
    for (const days of [31, 29]) {
      await db
        .insert(appErrors)
        .values({ at: daysAgo(days), route: "/x", message: `route Error ${days}` });
    }

    expect(await nightRead()).toBe("2026-11-08 complete");
    expect(await db.select({ message: appErrors.message }).from(appErrors)).toEqual([
      { message: "route Error 29" },
    ]);
  });

  it("clears player reads' raw bodies older than 90 days (D132)", async () => {
    for (const days of [91, 89]) {
      await db
        .insert(playerReads)
        .values({ unionId: OWN_ALLIANCE_ID, uid: 7, readAt: daysAgo(days), rawJson: { days } });
    }

    expect(await nightRead()).toBe("2026-11-08 complete");
    const rows = await db
      .select({ rawJson: playerReads.rawJson })
      .from(playerReads)
      .orderBy(playerReads.readAt);
    expect(rows).toEqual([{ rawJson: null }, { rawJson: { days: 89 } }]);
  });
});
