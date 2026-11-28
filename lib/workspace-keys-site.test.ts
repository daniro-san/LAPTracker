// Issue 855: a workspace's saved key that is LAP_API_KEY itself reads as the site's key. The squads read keeps
// the site key's event reserve and pauses in the event's window, starts from the day's read (no second quota
// count), and a 429 on it marks no workspace key; the daily read takes it as the site's, in any workspace; a
// key that differs keeps D124's rules. Neither key reaches a log line.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { getSquadRead } from "./repo/squads";
import { keyFacts, storeKey } from "./repo/workspace-keys";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters, runLogs } from "./schema";
import { QuotaExhaustedError, type CallOptions } from "./sources/types";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";
import { dailyTargets, sealKey, squadTargets } from "./workspace-keys";

/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
const SITE_KEY = `lap_${"our-site-test-key-".repeat(2)}x`;
const OTHER_KEY = `lap_${"ogs-officers-test-key-".repeat(2)}x`;
const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15, WORKSPACE_KEYS_SECRET: SECRET };
/** Friday 23:39 server time (UTC−2): Saturday UTC, the KvK's quota day. */
const FRI = { now: new Date("2026-11-21T01:39:00Z"), day: "2026-11-20" };
/** Saturday 11:00 server time, inside the KvK's Before/After. */
const IN_WINDOW = new Date("2026-11-21T13:00:00Z");

let db: Db;
let ws = 0;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  vi.stubEnv("LAP_API_KEY", SITE_KEY);
  await saveWorkspace(db, {
    unionId: OWN_ALLIANCE_ID,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  ws = (await db.query.workspaces.findFirst())?.id ?? 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The day's read left 480 − 21 = 459: above a workspace key's margin of 100, under the KvK's reserve. */
async function dayRead(quotaRemainingBefore = 480) {
  await db.insert(dailyReads).values({
    day: FRI.day,
    startedAt: new Date(`${FRI.day}T23:37:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore,
  });
  await db.insert(dailyRosters).values({
    readDay: FRI.day,
    unionId: OWN_ALLIANCE_ID,
    memberCount: 3,
    isFresh: true,
    memberUids: [1, 2, 3],
    memberNames: ["P1", "P2", "P3"],
    memberPower: [1, 1, 1],
    memberKills: [0, 0, 0],
  });
}

const saveKey = (key: string) =>
  storeKey(db, ws, sealKey(SECRET, ws, key), { status: "ok", quotaRemaining: 900 }, FRI.now);

/** A /v1 stand-in recording each call's key (undefined: LAP_API_KEY); `fail` makes every player call throw. */
function deps(now: Date, fail: Error | null = null) {
  const calls: { uid: number | "quota"; key: string | undefined }[] = [];
  const d: SquadsDeps = {
    now: () => now,
    env: CFG,
    paceMs: 0,
    fetch: async () => Response.json({}),
    secrets: [SITE_KEY],
    v1: {
      fetchPlayer: async (uid, onAttempt, _signal, options?: CallOptions) => {
        onAttempt?.(0);
        calls.push({ uid, key: options?.apiKey });
        if (fail) throw fail;
        return playerAnswer(uid);
      },
      fetchQuota: async (onAttempt, _signal, options?: CallOptions) => {
        onAttempt?.(0);
        calls.push({ uid: "quota", key: options?.apiKey });
        return { limit: 1000, used: 100, remaining: 900 };
      },
    },
  };
  return { d, calls };
}

describe("a saved key equal to LAP_API_KEY (issue 855)", () => {
  it("keeps the site key's event reserve, with no second quota count", async () => {
    await dayRead();
    await saveKey(SITE_KEY);
    expect((await squadTargets(db, SECRET, FRI.now)).map((t) => t.key)).toEqual([null]);
    const { d, calls } = deps(FRI.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 0 });
    // No /quota call: the run starts from the day's read, as on LAP_API_KEY.
    expect(calls).toEqual([]);
    expect(await getSquadRead(db, FRI.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota",
      quotaRemaining: 459,
    });
  });

  it("is paused in the event's window", async () => {
    await dayRead(900);
    await saveKey(SITE_KEY);
    const { d, calls } = deps(IN_WINDOW);
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect(calls).toEqual([]);
  });

  it("marks no workspace key on a 429, and no log line carries the key", async () => {
    await dayRead(900);
    await saveKey(SITE_KEY);
    const { d } = deps(FRI.now, new QuotaExhaustedError("429 on /players"));
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "stopped" });
    expect(await keyFacts(db, ws)).toMatchObject({ status: "ok", quotaRemaining: 900 });
    const lines = JSON.stringify(await db.select().from(runLogs));
    expect(lines).toContain("quota_429");
    expect(lines).not.toContain(SITE_KEY);
  });

  it("daily read: a site-equal key is the site's (key null), in another alliance's workspace too; a different key stays set", async () => {
    const add = async (unionId: number, slug: string, key: string) => {
      await saveWorkspace(db, { unionId, slug, discordGuildId: slug, leaderRoleIds: ["2"] });
      const id = (await db.query.workspaces.findMany()).find((w) => w.slug === slug)?.id ?? 0;
      await storeKey(
        db,
        id,
        sealKey(SECRET, id, key),
        { status: "ok", quotaRemaining: 900 },
        FRI.now,
      );
    };
    await saveKey(SITE_KEY);
    await add(67100002, "nse", SITE_KEY);
    await add(67100003, "own", OTHER_KEY);
    const targets = await dailyTargets(db, SECRET, FRI.now, []);
    expect(targets.map((t) => [t.unionId, t.key?.apiKey ?? null])).toEqual([
      [OWN_ALLIANCE_ID, null],
      [67100002, null],
      [67100003, OTHER_KEY],
    ]);
  });

  it("leaves a key that differs on D124's rules: its own quota call and only the margin", async () => {
    await dayRead();
    await saveKey(OTHER_KEY);
    const { d, calls } = deps(FRI.now);
    // 459 left on the site key would wait for the KvK; the workspace key's own 900 reads all three.
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 3 });
    expect(calls).toEqual([
      { uid: "quota", key: OTHER_KEY },
      ...[1, 2, 3].map((uid) => ({ uid, key: OTHER_KEY })),
    ]);
  });
});
