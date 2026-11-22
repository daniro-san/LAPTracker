// The tick's daily jobs after the day's first read (lib/tick.ts): D115's app_errors past 30 days are
// deleted, and D132's player reads keep their columns but lose raw bodies past 90 days. A failed job is a
// "Needs you" row on /admin until a later night's job succeeds (issue 507).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { needsYou } from "@/app/_ui/admin/needs-you";
import { makeClock } from "@/app/_ui/format";
import { OWN_ALLIANCE_ID } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, testContext } from "@/lib/app-context.test-helpers";
import { ago, fakeV1, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { failedCleanups } from "@/lib/queries/admin-page";
import { clearOldPlayerRaw } from "@/lib/repo/player-reads";
import { appErrors } from "@/lib/schema";
import { playerReads } from "@/lib/schema-squads";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The real clean-up, which a test makes fail once.
vi.mock("@/lib/repo/player-reads", async (original) => {
  const real = await original<typeof import("@/lib/repo/player-reads")>();
  return { ...real, clearOldPlayerRaw: vi.fn(real.clearOldPlayerRaw) };
});
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

/** The tick at `now` (the day's first read), every roster read; its answer as "day status". */
async function nightRead(now = NOW) {
  const { ctx, clock } = testContext(db);
  holder.ctx = ctx;
  clock.now = now;
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

/** /admin's "Needs you" rows at `now`, as the page builds them, with nothing else waiting. */
async function needs(now: Date) {
  const clock = makeClock("en", "Etc/GMT+2"); // the test env's SERVER_TZ
  const cleanups = (await failedCleanups(db, now)).map((c) => ({
    ...c,
    dayText: clock.weekday(c.at),
  }));
  const rows = needsYou({
    now,
    tick: { last: now, lastText: null },
    dailyRetry: false,
    requests: 0,
    errors24h: 0,
    cleanups,
    workspaces: [],
    deletions: 0,
    morningQuota: null,
    todos: 0,
  });
  return rows.map((r) => [r.label, r.state, r.href]);
}

describe("a failed daily clean-up on /admin (issue 507)", () => {
  /** Mon 9 Nov 23:37 ST: the next night's first read. */
  const NEXT_NIGHT = new Date("2026-11-10T01:37:00Z");

  it("shows 'The 90-day clean-up failed' in Needs you, linked to that night's run log", async () => {
    vi.mocked(clearOldPlayerRaw).mockRejectedValueOnce(
      Object.assign(new Error("canceling statement due to statement timeout"), {
        name: "DatabaseError",
      }),
    );

    expect(await nightRead()).toBe("2026-11-08 complete");
    expect(await needs(NOW)).toEqual([
      [
        "Daily clean-up",
        "The 90-day clean-up failed on Sun, Nov 8",
        "/admin/runs/daily/2026-11-08",
      ],
    ]);
  });

  it("clears the row once a later night's clean-up succeeds", async () => {
    vi.mocked(clearOldPlayerRaw).mockRejectedValueOnce(new Error("connection terminated"));
    expect(await nightRead()).toBe("2026-11-08 complete");
    // Until the next night's read, the failure still waits.
    expect((await needs(NEXT_NIGHT)).map(([label]) => label)).toEqual(["Daily clean-up"]);

    expect(await nightRead(NEXT_NIGHT)).toBe("2026-11-09 complete");
    expect(await needs(NEXT_NIGHT)).toEqual([]);
  });
});
