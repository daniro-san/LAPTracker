// A member's own days away (issue 829, D154 amended): only an approved link sets or clears them, for its
// own uid; the roll call and the card read them as the member's own report; days that have passed expire.
// Follow-up's side is tested in lib/private/members.test.ts. Invented workspaces, members and days only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { awayOn } from "@/lib/private/fact-fields";
import { memberCard } from "@/lib/private/member-card";
import { factsOf } from "@/lib/private/member-facts";

import { selfReportWorld } from "../facts/self-report.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ZONE = "Etc/GMT+2";
// T0 is Saturday 2026-11-07, 10:00 server time.
const DAYS = { from: "2026-11-09", until: "2026-11-11" };

let db: Db;
const world = selfReportWorld();
const { away, rook, card } = world;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await world.setUp(db);
  holder.ctx = testContext(db).ctx;
});

const factsOfAlpha = async () => factsOf(db, await rook());

describe("a member's own days away (issue 829)", () => {
  it("sets and clears days for the member's own link's uid, and refuses a body that names a uid", async () => {
    expect((await away("alpha:Ana Invented", { ...DAYS, uid: 102 })).status).toBe(400);
    const set = await away("alpha:Ana Invented", DAYS);
    expect([set.status, set.body.away]).toEqual([200, DAYS]);
    expect((await factsOfAlpha()).get(101)?.ownAway?.value).toMatchObject(DAYS);
    const cleared = await away("alpha:Ana Invented", { clear: true });
    expect([cleared.status, cleared.body.away]).toEqual([200, null]);
    expect((await factsOfAlpha()).get(101)?.ownAway?.value ?? null).toBeNull();
  });

  it("refuses a member whose link waits or who has none, and stores nothing for anyone else", async () => {
    expect((await away("alpha:Bobby", DAYS)).status).toBe(403);
    expect((await away("alpha:Nobody", DAYS)).status).toBe(403);
    expect((await factsOfAlpha()).get(102)?.ownAway).toBeUndefined();
  });

  it("makes the roll call leave the member out on those days only", async () => {
    await away("alpha:Ana Invented", DAYS);
    const facts = (await factsOfAlpha()).get(101);
    const on = (day: string) => awayOn(facts, day, ZONE);
    expect([on("2026-11-08"), on("2026-11-09"), on("2026-11-11"), on("2026-11-12")]).toEqual([
      null,
      { until: "2026-11-11" },
      { until: "2026-11-11" },
      null,
    ]);
  });

  it("shows officers the days on the member's card as the member's own report", async () => {
    expect((await card(101))?.selfReport?.away).toBeUndefined();
    await away("alpha:Ana Invented", DAYS);
    const shown = (await card(101))?.selfReport?.away;
    expect(shown?.head).toBe("Away, the member’s own report");
    expect(shown?.line).toContain("Left out of roll calls and Follow-up");
  });

  it("refuses a last day already past, and drops days once their last day has passed", async () => {
    const past = await away("alpha:Ana Invented", { from: "2026-11-01", until: "2026-11-06" });
    expect([past.status, past.body.code]).toEqual([400, "past"]);
    await away("alpha:Ana Invented", DAYS);
    const later = {
      now: new Date(T0.getTime() + 6 * 86_400_000),
      zone: ZONE,
      language: "en" as const,
      t: WORKSPACE_DICTIONARIES.en,
    };
    expect((await memberCard(db, await rook(), 101, later))?.selfReport?.away).toBeUndefined();
  });
});
