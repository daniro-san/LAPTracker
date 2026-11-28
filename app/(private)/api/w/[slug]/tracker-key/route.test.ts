// POST /api/w/[slug]/tracker-key (D124): only an officer of this workspace sets its key; "Test the key" is
// one /quota call on that key, never on LAP_API_KEY (lib/workspace-keys.test.ts checks the real adapter's
// header), at most 5 per 15 minutes; a key sealed under another master key reads as `reenter` without a
// write; and the key appears in no answer, page read, /admin read, activity line, log line, console line
// or analytics payload.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { activityPage } from "@/lib/private/desk-activity";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { settingsKeyView, trackerKeyView } from "@/lib/private/tracker-key";
import { listWorkspaces } from "@/lib/queries/workspaces";
import {
  appErrors,
  dailyReads,
  dailyRosters,
  runLogs,
  workspaces,
  workspaceUsers,
} from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { workspaceKeyChanges, workspaceKeys } from "@/lib/schema-keys";
import { runSquadsBatch } from "@/lib/squads-read";
import { playerAnswer } from "@/lib/squads.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
/** Built from a repeated phrase, so no secret scanner takes it for a real key; 45 characters long. */
const THEIR_KEY = `lap_${"their-alliance-test-".repeat(2)}key`;
const ENV = { ...TEST_ENV, LAP_API_KEY: "lap_our-site-test-key", WORKSPACE_KEYS_SECRET: SECRET };
const ORIGIN = "https://laptracker.test";
const NSE = 67109944;
const ID = () => crypto.randomUUID();

let db: Db;
const tokens = { officer: "", member: "", ogs: "" };
const ws = { nse: 0, ogs: 0 };
/** Every /quota call: the key it was sent on (undefined: LAP_API_KEY). */
let sent: (string | undefined)[] = [];

/** The route's context on `env`, its /quota recording the key it was sent on. */
function useContext(env: typeof ENV) {
  const ctx = testContext(db, env).ctx;
  ctx.v1.fetchQuota = async (onAttempt, _signal, options) => {
    onAttempt?.(0);
    sent.push(options?.apiKey);
    return { limit: 1000, used: 10, remaining: 990 };
  };
  holder.ctx = ctx;
  return ctx;
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  useContext(ENV);
  sent = [];
  for (const [name, unionId] of [
    ["nse", NSE],
    ["ogs", 67111155],
  ] as const) {
    const [row] = await db
      .insert(workspaces)
      .values({ unionId, slug: name, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
      .returning({ id: workspaces.id });
    ws[name] = row?.id ?? 0;
  }
  const people = [
    ["officer", ws.nse, "officer"],
    ["member", ws.nse, "member"],
    ["ogs", ws.ogs, "officer"],
  ] as const;
  for (const [who, workspaceId, tier] of people) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({
        workspaceId,
        discordUserId: `u-${who}`,
        displayName: who === "ogs" ? "Wren" : "Ana",
      })
      .returning({ id: workspaceUsers.id });
    tokens[who] = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, tier)).token;
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const post = (body: unknown, token: string) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/tracker-key`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

const setKey = (token: string, key = THEIR_KEY) =>
  post({ action: "set", key, requestId: ID() }, token);

const officerAccess = async () => {
  const access = await requireWorkspace(db, "nse", { get: () => ({ value: tokens.officer }) }, T0);
  if (!access.ok) throw new Error("no access");
  return access;
};

describe("POST /api/w/[slug]/tracker-key (D124)", () => {
  it("refuses a member and another workspace's officer, and stores nothing", async () => {
    for (const token of [tokens.member, tokens.ogs]) {
      const res = await setKey(token);
      expect([res.status, await res.json()]).toEqual([401, { code: "signed_out" }]);
    }
    expect(sent).toEqual([]);
    expect(await db.select().from(workspaceKeys)).toEqual([]);
  });

  it("tests the key with one /quota call on that key, never on LAP_API_KEY", async () => {
    const requestId = ID();
    const saved = await post({ action: "set", key: THEIR_KEY, requestId }, tokens.officer);
    expect(await saved.json()).toEqual({ state: "ok", last4: "-key", quotaRemaining: 990 });
    // The same request again (a lost answer) makes no second call.
    await post({ action: "set", key: THEIR_KEY, requestId }, tokens.officer);
    expect(sent).toEqual([THEIR_KEY]);
  });

  it("refuses a sixth test within 15 minutes with 429, without calling the tracker", async () => {
    for (let i = 0; i < 5; i++) expect((await setKey(tokens.officer)).status).toBe(200);
    const sixth = await setKey(tokens.officer);
    expect([sixth.status, await sixth.json()]).toEqual([429, { code: "rate_limited" }]);
    expect(sent).toHaveLength(5);
  });

  it("shows a key sealed under another master key as `reenter`, and leaves its row as it was", async () => {
    await setKey(tokens.officer);
    const before = await db.select().from(workspaceKeys);
    const other = { WORKSPACE_KEYS_SECRET: Buffer.alloc(32, 9).toString("base64") };
    const view = await trackerKeyView(db, await officerAccess(), other, T0);
    expect(view.state).toBe("reenter");
    expect(await db.select().from(workspaceKeys)).toEqual(before);
  });

  it("says the saved key is the site's own only when it equals LAP_API_KEY (issue 855)", async () => {
    // Key-shaped (the form's rule), from a repeated phrase like THEIR_KEY.
    const site = `lap_${"our-site-test-key-".repeat(2)}x`;
    vi.stubEnv("LAP_API_KEY", site);
    await setKey(tokens.officer);
    expect((await settingsKeyView(db, await officerAccess(), ENV, T0)).siteKey).toBe(false);
    await setKey(tokens.officer, site);
    expect((await settingsKeyView(db, await officerAccess(), ENV, T0)).siteKey).toBe(true);
  });

  it("never lets the key into an answer, a page read, /admin, Home's activity, a log, the console or analytics", async () => {
    const printed: string[] = [];
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        printed.push(args.map(String).join(" "));
      });
    }
    // Analytics on, as in production: every payload sent to PostHog is kept for the scan.
    const ctx = useContext({ ...ENV, VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" });
    const payloads: string[] = [];
    ctx.fetch = async (_input, init) => {
      payloads.push(String(init?.body ?? ""));
      return Response.json({});
    };
    const answers = [await (await setKey(tokens.officer)).text()];
    answers.push(await (await setKey(tokens.officer, `${THEIR_KEY}-2`)).text());
    answers.push(await (await setKey(tokens.officer, "not-a-key")).text());
    await vi.waitFor(() => expect(payloads.join()).toContain("ws_action"));

    // The nightly squads read on that key: one member's call fails with the key in its error. D134: the
    // owner allows it and the officers turned it on.
    const squadsOn = { squads: true };
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId: ws.nse, switches: squadsOn, allianceSwitches: squadsOn });
    const day = "2026-11-19";
    await db.insert(dailyReads).values({ day, startedAt: T0, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId: NSE,
      memberCount: 2,
      isFresh: true,
      memberUids: [11, 12],
      memberNames: ["P11", "P12"],
      memberPower: [1, 1],
      memberKills: [0, 0],
    });
    const now = new Date("2026-11-20T01:39:00Z");
    await runSquadsBatch(
      {
        now: () => now,
        env: { ...ENV, SAMPLE_EVERY_MIN: 15 },
        paceMs: 0,
        fetch: async () => Response.json({}),
        v1: {
          fetchQuota: ctx.v1.fetchQuota,
          fetchPlayer: async (uid, onAttempt) => {
            onAttempt?.(0);
            if (uid === 11) throw new Error(`no answer for /players/${uid} on ${THEIR_KEY}-2`);
            return playerAnswer(uid);
          },
        },
      },
      db,
    );

    const access = await officerAccess();
    const outputs = [
      ...answers,
      await trackerKeyView(db, access, ENV, now),
      await listWorkspaces(db, now),
      await activityPage(db, access, { now, zone: "Etc/GMT+2" }, null, 20),
      await db.select().from(runLogs),
      await db.select().from(appErrors),
      await db.select().from(workspaceKeyChanges),
      await db.select().from(workspaceKeys),
      printed,
      payloads,
    ];
    const text = JSON.stringify(outputs);
    expect(text).not.toContain("their-alliance-test-their");
    // The scan saw real outputs: the save, the run's lines, Home's line and the analytics event.
    expect(text).toContain("squads.batch");
    expect(
      (await activityPage(db, access, { now, zone: "Etc/GMT+2" }, null, 20)).lines.length,
    ).toBe(1);
  });
});
