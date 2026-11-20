// /admin's "Run the squads read now" (D117, amendment 2026-11-19b): PIN only; the batches start after the
// answer, outside the nightly window, one after another while another fits in the press's budget.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import { request, TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { dailyReads, dailyRosters, runLogs, workspaces } from "@/lib/schema";
import { squadReads } from "@/lib/schema-squads";
import { playerAnswer } from "@/lib/squads.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// Work after the answer (`after`) needs a Next request; here it is kept to be run by the test.
const later = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void later.push(task),
}));

const { POST } = await import("./route");

const press = (headers: Record<string, string> = { "x-edit-pin": TEST_PIN }) =>
  POST(request(`/api/admin/squads-read?union=${OWN_ALLIANCE_ID}`, { headers }));

let db: Db;
let players: number[];
let clock: { now: Date };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  later.length = 0;
  await db
    .insert(workspaces)
    .values({ unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // Thursday's daily read (UTC−2), done at 23:37 server time.
  await db.insert(dailyReads).values({
    day: "2026-11-19",
    startedAt: new Date("2026-11-20T01:37:00Z"),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-19",
    unionId: OWN_ALLIANCE_ID,
    memberCount: 3,
    isFresh: true,
    memberUids: [1, 2, 3],
    memberNames: ["P1", "P2", "P3"],
    memberPower: [1, 1, 1],
    memberKills: [0, 0, 0],
  });
  const test = testContext(db);
  const { ctx } = test;
  clock = test.clock;
  clock.now = new Date("2026-11-20T15:00:00Z"); // Friday 13:00 server time: outside the nightly window
  players = [];
  ctx.v1.fetchPlayer = async (uid, onAttempt) => {
    onAttempt?.(0);
    players.push(uid);
    return playerAnswer(uid);
  };
  holder.ctx = ctx;
});

describe("POST /api/admin/squads-read", () => {
  it("refuses without the right PIN and starts nothing", async () => {
    expect((await press({})).status).toBe(401);
    expect((await press({ "x-edit-pin": "000000" })).status).toBe(401);
    expect(later).toHaveLength(0);
  });

  it("reads after the answer, on the quota day's read, and logs the batch as forced", async () => {
    const res = await press();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ day: "2026-11-19", workspaces: ["ogs"] });
    expect(players).toEqual([]); // nothing before the answer
    await later[0]?.();
    expect(players).toEqual([1, 2, 3]);
    const [read] = await db.select().from(squadReads);
    expect(read).toMatchObject({ day: "2026-11-19", status: "done", callsUsed: 3 });
    const line = (await db.select().from(runLogs)).find((l) => l.code === "squads.batch");
    expect(line?.data).toMatchObject({ forced: true, players: 3 });
  });

  it("runs batches one after another while another whole batch fits in the press's budget", async () => {
    // Every second call is cut before it is sent (a batch's deadline), and each read takes 100 s.
    let attempt = 0;
    (holder.ctx as AppContext).v1.fetchPlayer = async (uid, onAttempt) => {
      if (attempt++ % 2 === 1) throw new Error("cut");
      onAttempt?.(0);
      players.push(uid);
      clock.now = new Date(clock.now.getTime() + 100_000);
      return playerAnswer(uid);
    };
    expect((await press()).status).toBe(202);
    await later[0]?.();
    // Batch 1 ends at 100 s and a 60 s batch 2 fits by 240 s; after batch 2 (200 s) a third would not.
    expect(players).toEqual([1, 2]);
    const [read] = await db.select().from(squadReads);
    expect(read).toMatchObject({ status: "running", callsUsed: 2, batchAt: null });
  });

  it("refuses during the event's Before/After window and just before the quota reset", async () => {
    clock.now = new Date("2026-11-21T13:00:00Z"); // Saturday 11:00 server time, inside the KvK's window
    expect(await (await press()).json()).toEqual({ code: "event_window" });
    clock.now = new Date("2026-11-20T23:59:30Z"); // a 60 s batch would end after 00:00 UTC
    expect(await (await press()).json()).toEqual({ code: "quota_reset" });
    expect(later).toHaveLength(0);
  });
});
