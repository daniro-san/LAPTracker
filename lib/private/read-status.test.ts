// The desk's read status bar (D135, issue 478) against PGlite: one test per state. Running (counts move),
// done (shown for 30 minutes), waiting for retries, paused (the reserve, the event window), stopped (the
// limit, the cap, another reason), skipped, the key (to paste again, refused, spent today), a late or failed
// roster, nothing to say, and a failed connection that renders nothing.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { AppContext } from "../app-context";
import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { workspaceKeys } from "../schema-keys";
import { squadQueue, squadReads } from "../schema-squads";
import { seedWorkspace } from "../workspace-data.test-helpers";
import { masterFingerprint } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { frameReadStatus, readStatus } from "./read-status";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("../app-context", async (original) => ({
  ...(await original<typeof import("../app-context")>()),
  getAppContext: () => holder.ctx,
}));
// withPageDb closes the request's connection in `after` (D141, 2026-11-21), which needs a Next request.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));

/** Friday 01:00 server time (UTC−2): Thursday's 23:30 daily read is the quota day's, its window closed. */
const NOW = new Date("2026-11-20T03:00:00Z");
const DAY = "2026-11-19";
const STARTED = new Date("2026-11-20T01:37:00Z");
const MIN = 60_000;
const t = WORKSPACE_DICTIONARIES.en;

/** The own alliance with no saved key and the keys off: its squads are read on the site's key (D132). */
const access = (squads = true) =>
  ({
    workspaceId: 1,
    unionId: OWN_ALLIANCE_ID,
    features: { on: new Set(squads ? ["squads"] : []), caps: { ai: 0, translate: 0 } },
  }) as unknown as WorkspaceAccess;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(dailyReads).values({ day: DAY, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    isFresh: true,
    memberUids: [1, 2, 3, 4],
    memberNames: ["A", "B", "C", "D"],
    memberPower: [1, 1, 1, 1],
    memberKills: [1, 1, 1, 1],
  });
});

const read = (at = NOW, squads = true) => readStatus(db, access(squads), TEST_ENV, at, t, "en");

const SECRET = Buffer.alloc(32, 7).toString("base64");
const KEYS_ON = { ...TEST_ENV, WORKSPACE_KEYS_SECRET: SECRET };

/** A saved key of the alliance's own (sealed under the current master key unless `masterFp`). */
async function ownKey(
  status: "ok" | "invalid" | "out_of_quota",
  masterFp = masterFingerprint(SECRET),
): Promise<WorkspaceAccess> {
  const { workspaceId } = await seedWorkspace(db, "wren", OWN_ALLIANCE_ID);
  await db.insert(workspaceKeys).values({
    workspaceId,
    ciphertext: "sealed",
    nonce: "n",
    masterFp,
    last4: "ab12",
    status,
    statusAt: NOW,
  });
  return { ...access(), workspaceId };
}

/** The day's row and a queue of four: `done` of them read, the rest waiting and due. */
async function day(
  row: { status: "running" | "done" | "stopped" | "skipped"; reason?: string; finishedAt?: Date },
  done: number,
  on = DAY,
) {
  const base = { day: on, unionId: OWN_ALLIANCE_ID };
  await db.insert(squadReads).values({ ...base, startedAt: STARTED, members: 4, ...row });
  await db.insert(squadQueue).values(
    [1, 2, 3, 4].map((uid) => ({
      ...base,
      uid,
      state: uid <= done ? ("done" as const) : ("waiting" as const),
      dueAt: STARTED,
    })),
  );
}

describe("readStatus (D135)", () => {
  it("running: the counts move and the bar polls; nothing when the squads read is off", async () => {
    await day({ status: "running" }, 1);
    expect(await read()).toEqual({
      lines: [
        {
          id: "squads",
          tone: "progress",
          text: "Squads: 1 of 4 read so far · started 23:37 ST",
        },
      ],
      running: true,
    });
    await db.update(squadQueue).set({ state: "done" });
    expect((await read()).lines[0]?.text).toContain("Squads: 4 of 4 read so far");
    expect(await read(NOW, false)).toEqual({ lines: [], running: false });
  });

  it("done: says when, for 30 minutes, then nothing", async () => {
    const finishedAt = new Date(NOW.getTime() - 29 * MIN);
    await day({ status: "done", finishedAt }, 3);
    await db.update(squadQueue).set({ state: "failed" }).where(eq(squadQueue.uid, 4));
    expect(await read()).toEqual({
      lines: [
        {
          id: "squads",
          tone: "quiet",
          text: "Squads: 3 of 4 read · the tracker missed 1 · updated at 00:31 ST",
          until: finishedAt.getTime() + 30 * MIN,
        },
      ],
      running: false,
    });
    expect((await read(new Date(NOW.getTime() + MIN))).lines).toEqual([]);
  });

  it("paused for the reserve, and stopped at the limit until the reset at 00:00 UTC", async () => {
    await day({ status: "running", reason: "quota" }, 2);
    expect((await read()).lines[0]).toMatchObject({
      tone: "quiet",
      text: "Squads paused at 2 of 4 · tracker calls are kept for other reads",
    });
    await db.update(squadReads).set({ status: "stopped", reason: "quota_429", finishedAt: NOW });
    expect(await read()).toMatchObject({
      lines: [
        {
          tone: "attention",
          text: "Squads paused at 2 of 4 · today’s tracker limit is reached · it resets at 00:00 UTC (22:00 ST)",
        },
      ],
      running: false,
    });
  });

  it("skipped: says why in plain words", async () => {
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "skipped",
      reason: "quota_unknown",
      startedAt: STARTED,
      finishedAt: STARTED,
      members: 4,
    });
    expect((await read()).lines).toEqual([
      {
        id: "squads",
        tone: "attention",
        text: "Squads not read today: tracker limit unknown",
      },
    ]);
  });

  it("a key to paste again comes first, with Alliance settings and the key card mark", async () => {
    await day({ status: "running" }, 1);
    const me = await ownKey("ok", "another");
    const { lines } = await readStatus(db, me, KEYS_ON, NOW, t, "en");
    // Sealed under another master key: `reenter`, and nobody reads the squads (`squadsKey`).
    expect(lines).toEqual([
      {
        id: "key",
        tone: "attention",
        text: "Tracker key: paste it again in Alliance settings",
        settings: true,
        keyCard: true,
      },
    ]);
  });

  it("a roster not in after its window says the cards keep the last numbers; nothing when all is well", async () => {
    expect(await read()).toEqual({ lines: [], running: false });
    await db.delete(dailyRosters);
    expect((await read()).lines).toEqual([
      {
        id: "roster",
        tone: "attention",
        text: "Today’s daily update is late · the cards keep the last numbers · squads wait for it",
      },
    ]);
    // Inside the read's window it is not late yet.
    expect((await read(new Date("2026-11-20T02:00:00Z"))).lines).toEqual([]);
  });

  it("a failed roster read says so", async () => {
    await db.update(dailyRosters).set({ error: "upstream_502" });
    expect((await read()).lines).toEqual([
      {
        id: "roster",
        tone: "attention",
        text: "Today’s daily update failed · the cards keep the last numbers · squads wait for it",
      },
    ]);
  });

  it("a refused key: its line only, and no roster line for an alliance the daily read leaves out on purpose", async () => {
    await day({ status: "running" }, 1);
    await db.delete(dailyRosters);
    const me = await ownKey("invalid");
    expect(await readStatus(db, me, KEYS_ON, NOW, t, "en")).toEqual({
      lines: [
        {
          id: "key",
          tone: "attention",
          text: "Tracker key refused · paste a new key in Alliance settings",
          settings: true,
          keyCard: true,
        },
      ],
      running: false,
    });
    // A key spent today: the daily read and the squads read both leave it out until the reset, so the
    // roster and the squads say nothing either (Home's key card says it).
    await db.update(workspaceKeys).set({ status: "out_of_quota" });
    expect(await readStatus(db, me, KEYS_ON, NOW, t, "en")).toEqual({ lines: [], running: false });
  });

  it("waiting: everyone left waits for a later try, with its time", async () => {
    await day({ status: "running" }, 3);
    const later = new Date(NOW.getTime() + 12 * MIN);
    await db.update(squadQueue).set({ attempts: 1, dueAt: later }).where(eq(squadQueue.uid, 4));
    expect((await read()).lines[0]).toEqual({
      id: "squads",
      tone: "progress",
      text: "Squads: 3 of 4 read · 1 to try again at 01:12 ST",
    });
  });

  it("paused in the event window on the site's key, with no polling", async () => {
    // Saturday 12:00 server time: inside the event's window (TEST_ENV: Saturday 10:00–14:45).
    const saturday = new Date("2026-11-21T14:00:00Z");
    const friday = "2026-11-20";
    await db.insert(dailyReads).values({ day: friday, startedAt: saturday, status: "complete" });
    await db.update(dailyRosters).set({ readDay: friday });
    await day({ status: "running" }, 2, friday);
    expect(await read(saturday)).toEqual({
      lines: [
        {
          id: "squads",
          tone: "quiet",
          text: "Squads paused at 2 of 4 · they go on after the event",
        },
      ],
      running: false,
    });
  });

  it("stopped for another reason: the day's cap, or a reason with no words of its own", async () => {
    await day({ status: "stopped", reason: "cap", finishedAt: NOW }, 2);
    expect((await read()).lines[0]?.text).toBe(
      "Squads stopped at 2 of 4 · today’s 120 reads are used",
    );
    await db.update(squadReads).set({ reason: "budget" });
    expect((await read()).lines[0]?.text).toBe(
      "Squads stopped at 2 of 4 · the tracker did not answer",
    );
  });
});

describe("frameReadStatus (D135)", () => {
  it("renders nothing and logs a code only when the connection fails", async () => {
    const openDb = vi.fn(() => {
      throw new Error("connect ECONNREFUSED postgres://secret@db.test");
    });
    holder.ctx = { env: TEST_ENV, openDb, report: vi.fn() } as unknown as AppContext;
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await frameReadStatus(access(), t, NOW, "en")).toBeNull();
    expect(openDb).toHaveBeenCalledTimes(1);
    expect(log.mock.calls).toEqual([[JSON.stringify({ code: "w.read_status.failed" })]]);
    log.mockRestore();
  });

  it("reports the failure to error tracking with where and its code only, never the workspace or a member (D71)", async () => {
    const failure = new Error("connect ECONNREFUSED postgres://secret@db.test");
    const openDb = vi.fn(() => {
      throw failure;
    });
    const report = vi.fn<AppContext["report"]>();
    holder.ctx = { env: TEST_ENV, openDb, report } as unknown as AppContext;
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await frameReadStatus(access(), t, NOW, "en")).toBeNull();
    expect(report.mock.calls).toEqual([
      [failure, { route: "lib/private/read-status.ts", kind: "w.read_status.failed" }],
    ]);
    // toEqual ignores undefined keys: the context's keys, exactly.
    expect(Object.keys(report.mock.calls[0]?.[1] ?? {}).sort()).toEqual(["kind", "route"]);
  });
});
