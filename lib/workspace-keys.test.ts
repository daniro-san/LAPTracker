// Each workspace's own tracker key (D124): sealed per workspace (AES-256-GCM, the workspace id as associated
// data), and the squads read on each workspace's own key only. A 401 marks the key invalid and stops that
// workspace's reads; a 429 marks it out of quota until the reset; neither falls back to LAP_API_KEY, which
// only the own alliance (OGs) uses, and only until its officers save a key.
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import { recordAppError } from "./app-errors";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { createRunLogger } from "./logger";
import { insertRunLog } from "./repo/run-logs";
import { setAllianceSwitch, setSwitch } from "./repo/workspace-features";
import { keyFacts, storeKey } from "./repo/workspace-keys";
import { saveWorkspace } from "./repo/workspaces";
import { appErrors, dailyReads, dailyRosters, runLogs, workspaces } from "./schema";
import { workspaceKeys } from "./schema-keys";
import { playerReads } from "./schema-squads";
import { v1 } from "./sources";
import { QuotaExhaustedError, UpstreamError, type CallOptions } from "./sources/types";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";
import { checkKey, openKey, sealKey, squadTargets } from "./workspace-keys";

/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
/** Built from a repeated phrase, so no secret scanner takes them for real keys; 45 characters long. */
const THEIR_KEY = `lap_${"their-alliance-test-".repeat(2)}key`;
const OGS_KEY = `lap_${"ogs-officers-test-key-".repeat(2)}x`;
const OTHER = 67109944;
const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15, WORKSPACE_KEYS_SECRET: SECRET };
/** Thursday 23:39 server time (UTC−2): the day's read is done, the squads read is due. */
const THU = { now: new Date("2026-11-20T01:39:00Z"), day: "2026-11-19" };
/** The next server day, after the 00:00 UTC quota reset. */
const FRI = { now: new Date("2026-11-21T01:39:00Z"), day: "2026-11-20" };

let db: Db;
const ws = { ogs: 0, other: 0 };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  for (const [name, unionId] of [
    ["ogs", OWN_ALLIANCE_ID],
    ["other", OTHER],
  ] as const) {
    await saveWorkspace(db, {
      unionId,
      slug: name,
      discordGuildId: String(unionId),
      leaderRoleIds: ["2"],
    });
    const [row] = await db.select().from(workspaces).where(eq(workspaces.unionId, unionId));
    ws[name] = row?.id ?? 0;
  }
  // D134: the other alliance's squads read is allowed by the owner and turned on by its officers.
  await setSwitch(db, ws.other, "squads", true, new Date(0));
  await setAllianceSwitch(db, ws.other, "squads", true, new Date(0));
});

/** The day's read, with OGs' members 1–3 and the other alliance's 11–13. */
async function dayRead(day: string) {
  await db.insert(dailyReads).values({
    day,
    startedAt: new Date(`${day}T23:37:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
  for (const [unionId, uids] of [
    [OWN_ALLIANCE_ID, [1, 2, 3]],
    [OTHER, [11, 12, 13]],
  ] as const) {
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId,
      memberCount: uids.length,
      isFresh: true,
      memberUids: [...uids],
      memberNames: uids.map((u) => `P${u}`),
      memberPower: uids.map(() => 1),
      memberKills: uids.map(() => 0),
    });
  }
}

const saveKey = (workspaceId: number, key: string, now = THU.now) =>
  storeKey(
    db,
    workspaceId,
    sealKey(SECRET, workspaceId, key),
    { status: "ok", quotaRemaining: 900 },
    now,
  );

/** A /v1 stand-in that records each call's key (undefined: LAP_API_KEY); `fail(uid)` makes a call throw. */
function deps(now: Date, fail: (uid: number) => Error | null = () => null) {
  const calls: { uid: number | "quota"; key: string | undefined }[] = [];
  const d: SquadsDeps = {
    now: () => now,
    env: CFG,
    paceMs: 0,
    fetch: async () => Response.json({}),
    v1: {
      fetchPlayer: async (uid, onAttempt, _signal, options?: CallOptions) => {
        onAttempt?.(0);
        calls.push({ uid, key: options?.apiKey });
        const e = fail(uid);
        if (e) throw e;
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

describe("sealing a workspace key (D124)", () => {
  it("opens with the same workspace id, and fails for another workspace's", () => {
    const sealed = sealKey(SECRET, 7, THEIR_KEY);
    expect(sealed.last4).toBe("-key");
    expect(sealed.ciphertext).not.toContain(THEIR_KEY);
    expect(openKey(SECRET, 7, sealed)).toBe(THEIR_KEY);
    expect(() => openKey(SECRET, 8, sealed)).toThrow();
    // A new nonce on every write: the same key seals differently.
    expect(sealKey(SECRET, 7, THEIR_KEY).ciphertext).not.toBe(sealed.ciphertext);
  });
});

describe("Test the key (D124)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends one /quota call on the workspace key through the real adapter, never LAP_API_KEY", async () => {
    vi.stubEnv("LAP_API_KEY", "lap_our-site-test-key");
    vi.stubEnv("LAP_API_BASE_URL", "https://v1.test/v1");
    const sent: string[] = [];
    let status = 200;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      if (status !== 200) return new Response("{}", { status });
      return Response.json({ quota: { limit: 1000, used: 10, remaining: 990 } });
    });
    expect(await checkKey(v1, THEIR_KEY)).toEqual({ status: "ok", quotaRemaining: 990 });
    status = 401;
    expect(await checkKey(v1, THEIR_KEY)).toEqual({ status: "invalid", quotaRemaining: null });
    expect(sent).toEqual([
      `https://v1.test/v1/quota Bearer ${THEIR_KEY}`,
      `https://v1.test/v1/quota Bearer ${THEIR_KEY}`,
    ]);
  });
});

describe("the squads read on each workspace's own key (D124)", () => {
  it("reads OGs on LAP_API_KEY until its officers save a key, and a workspace without a key not at all", async () => {
    await dayRead(THU.day);
    const { d, calls } = deps(THU.now);
    await runSquadsBatch(d, db);
    expect(calls).toEqual([1, 2, 3].map((uid) => ({ uid, key: undefined })));

    // Once OGs' officers save their own key, OGs reads on it, after one /quota call on it.
    await dayRead(FRI.day);
    await saveKey(ws.ogs, OGS_KEY);
    const own = deps(FRI.now);
    await runSquadsBatch(own.d, db);
    expect(own.calls.map((c) => c.key)).toEqual([OGS_KEY, OGS_KEY, OGS_KEY, OGS_KEY]);
  });

  it("reads nothing for OGs once its workspace is deleted (D125)", async () => {
    await dayRead(THU.day);
    await db.delete(workspaces).where(eq(workspaces.id, ws.ogs));
    const { d, calls } = deps(THU.now);
    await runSquadsBatch(d, db);
    expect(calls.filter((c) => c.key === undefined)).toEqual([]);
  });

  it("reads no workspace whose squads read the owner turned off, and its squads stay (D126)", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    await setSwitch(db, ws.other, "squads", false, THU.now);
    await setSwitch(db, ws.ogs, "squads", false, THU.now);
    expect(await squadTargets(db, SECRET, THU.now)).toEqual([]);
    const { d, calls } = deps(THU.now);
    await runSquadsBatch(d, db);
    expect(calls).toEqual([]);
    await setSwitch(db, ws.other, "squads", true, THU.now);
    expect((await squadTargets(db, SECRET, THU.now)).map((t) => t.workspaceId)).toEqual([ws.other]);
  });

  it("reads another workspace on its own key only, never on LAP_API_KEY", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    const { d, calls } = deps(THU.now);
    await runSquadsBatch(d, db);
    const theirs = calls.filter((c) => c.key !== undefined);
    expect(theirs).toEqual(["quota", 11, 12, 13].map((uid) => ({ uid, key: THEIR_KEY })));
    // LAP_API_KEY made OGs' calls only.
    expect(calls.filter((c) => c.key === undefined).map((c) => c.uid)).toEqual([1, 2, 3]);
  });

  it("never spends one workspace's key on another's members, even with its sealed row copied over (issue 471)", async () => {
    await dayRead(THU.day);
    await saveKey(ws.ogs, OGS_KEY);
    await saveKey(ws.other, THEIR_KEY);
    const members = (calls: { uid: number | "quota"; key: string | undefined }[], key: string) =>
      calls.filter((c) => c.key === key && c.uid !== "quota").map((c) => c.uid);
    const both = deps(THU.now);
    await runSquadsBatch(both.d, db);
    expect([members(both.calls, OGS_KEY), members(both.calls, THEIR_KEY)]).toEqual([
      [1, 2, 3],
      [11, 12, 13],
    ]);
    // D132: each answer is kept under the alliance whose key read it.
    const kept = await db.select().from(playerReads).orderBy(playerReads.uid);
    expect(kept.map((r) => r.unionId === OTHER)).toEqual([false, false, false, true, true, true]);

    // OGs' sealed key copied into the other workspace's row: it opens for neither, and is not spent there.
    const [own] = await db
      .select()
      .from(workspaceKeys)
      .where(eq(workspaceKeys.workspaceId, ws.ogs));
    await db
      .update(workspaceKeys)
      .set({ ciphertext: own?.ciphertext, nonce: own?.nonce })
      .where(eq(workspaceKeys.workspaceId, ws.other));
    await dayRead(FRI.day);
    const copied = deps(FRI.now);
    await runSquadsBatch(copied.d, db);
    expect(members(copied.calls, OGS_KEY)).toEqual([1, 2, 3]);
    expect(copied.calls.filter((c) => typeof c.uid === "number" && c.uid > 10)).toEqual([]);
    expect((await keyFacts(db, ws.other)).status).toBe("reenter");
  });

  it("marks the key invalid on a 401 and stops that workspace's reads", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    const { d, calls } = deps(THU.now, (uid) => (uid === 11 ? new UpstreamError(401) : null));
    await runSquadsBatch(d, db);
    expect(calls.filter((c) => c.key === THEIR_KEY).map((c) => c.uid)).toEqual(["quota", 11]);
    expect((await keyFacts(db, ws.other)).status).toBe("invalid");

    await dayRead(FRI.day);
    const next = deps(FRI.now);
    await runSquadsBatch(next.d, db);
    expect(next.calls.filter((c) => c.key !== undefined)).toEqual([]);
  });

  it("marks the key out of quota on a 429, with no call on LAP_API_KEY for it, until the reset", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    const { d, calls } = deps(THU.now, (uid) =>
      uid === 12 ? new QuotaExhaustedError("429") : null,
    );
    await runSquadsBatch(d, db);
    expect(calls.filter((c) => c.key === THEIR_KEY).map((c) => c.uid)).toEqual(["quota", 11, 12]);
    expect(calls.some((c) => c.key === undefined && typeof c.uid === "number" && c.uid > 10)).toBe(
      false,
    );
    expect(await keyFacts(db, ws.other)).toMatchObject({
      status: "out_of_quota",
      quotaRemaining: 0,
    });

    // After the 00:00 UTC reset the key reads again.
    await dayRead(FRI.day);
    const next = deps(FRI.now);
    await runSquadsBatch(next.d, db);
    expect(next.calls.filter((c) => c.key === THEIR_KEY).map((c) => c.uid)).toEqual([
      "quota",
      11,
      12,
      13,
    ]);
    expect((await keyFacts(db, ws.other)).status).toBe("ok");
  });
});

describe("a changed WORKSPACE_KEYS_SECRET (D124)", () => {
  it("leaves a row sealed under another master key untouched and reads nothing on it", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    const before = await db.select().from(workspaceKeys);
    const { d, calls } = deps(THU.now);
    d.env = { ...CFG, WORKSPACE_KEYS_SECRET: Buffer.alloc(32, 9).toString("base64") };
    await runSquadsBatch(d, db);
    // Its fingerprint is not the new secret's: no write, so the old deployment's rows stay readable.
    expect(await db.select().from(workspaceKeys)).toEqual(before);
    // No tracker call for it, the /quota test included; OGs still reads on LAP_API_KEY.
    expect(calls.filter((c) => c.key !== undefined)).toEqual([]);
    expect(calls.map((c) => c.uid)).toEqual([1, 2, 3]);
  });

  it("marks a key that fails to open under its own master key `reenter`, not `invalid`", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    await db.update(workspaceKeys).set({ ciphertext: Buffer.alloc(48, 1).toString("base64") });
    const { d, calls } = deps(THU.now);
    await runSquadsBatch(d, db);
    expect((await keyFacts(db, ws.other)).status).toBe("reenter");
    expect(calls.filter((c) => c.key !== undefined)).toEqual([]);
  });
});

describe("a 403 on a workspace key (D124)", () => {
  it("stops that night's read and leaves the key's status as it was", async () => {
    await dayRead(THU.day);
    await saveKey(ws.other, THEIR_KEY);
    const { d, calls } = deps(THU.now, (uid) => (uid === 11 ? new UpstreamError(403) : null));
    await runSquadsBatch(d, db);
    expect(calls.filter((c) => c.key === THEIR_KEY).map((c) => c.uid)).toEqual(["quota", 11]);
    expect((await keyFacts(db, ws.other)).status).toBe("ok");
  });
});

describe("an error carrying a workspace key (D124)", () => {
  it("is redacted in run_logs and app_errors", async () => {
    const log = createRunLogger(
      { insertRunLog: (line) => insertRunLog(db, line) },
      { readDay: THU.day, secrets: [], now: () => THU.now },
    );
    await dayRead(THU.day);
    await log.warn("squads.batch", { error: `failed on ${THEIR_KEY}` });
    await log.shutdown();
    const { ctx } = testContext(db, CFG);
    const error = new Error(`upstream said ${THEIR_KEY}`);
    await recordAppError(ctx, { route: "/api/tick", kind: "after", digest: null, error });
    const stored = JSON.stringify([
      await db.select().from(runLogs),
      await db.select().from(appErrors),
    ]);
    expect(stored).toContain("failed on");
    expect(stored).not.toContain("their-alliance-test-their");
  });
});
