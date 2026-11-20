// The desk's read status bar (D135, issue 478) against PGlite: one test per state. Running (counts move),
// done (shown for 30 minutes), paused and stopped, skipped, the key to enter again, a late roster, and
// nothing to say. Counts and server times only. Invented ids.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { workspaceKeys } from "../schema-keys";
import { squadQueue, squadReads } from "../schema-squads";
import { seedWorkspace } from "../workspace-data.test-helpers";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { readStatus } from "./read-status";

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

const read = (at = NOW, squads = true) => readStatus(db, access(squads), TEST_ENV, at, t);

/** The day's row and a queue of four: `done` of them read, the rest waiting and due. */
async function day(
  row: { status: "running" | "done" | "stopped" | "skipped"; reason?: string; finishedAt?: Date },
  done: number,
) {
  const base = { day: DAY, unionId: OWN_ALLIANCE_ID };
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
    const secret = Buffer.alloc(32, 7).toString("base64");
    const { workspaceId } = await seedWorkspace(db, "wren", OWN_ALLIANCE_ID);
    await db.insert(workspaceKeys).values({
      workspaceId,
      ciphertext: "sealed",
      nonce: "n",
      masterFp: "another",
      last4: "ab12",
      status: "invalid",
      statusAt: NOW,
    });
    const env = { ...TEST_ENV, WORKSPACE_KEYS_SECRET: secret };
    const { lines } = await readStatus(db, { ...access(), workspaceId }, env, NOW, t);
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
        text: "Today’s roster is late · the cards keep the last numbers · squads wait for it",
      },
    ]);
    // Inside the read's window it is not late yet.
    expect((await read(new Date("2026-11-20T02:00:00Z"))).lines).toEqual([]);
  });
});
