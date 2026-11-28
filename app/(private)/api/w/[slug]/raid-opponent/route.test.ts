// POST /api/w/[slug]/raid-opponent (issue 861, D165): an officer sets this week's raid opponent after one
// read by tag on the alliance's own key, clears it and takes it back with Undo, with no further call; a
// workspace with no key of its own is refused and nothing is sent, never on LAP_API_KEY. Stubs only, no
// upstream call; invented names and values.
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { workspaceKeys } from "@/lib/schema-keys";
import { raidOpponents } from "@/lib/schema-shield";
import { sealKey } from "@/lib/workspace-keys";

type AllianceSnapshotInput = Awaited<ReturnType<AppContext["v1"]["fetchAllianceByTag"]>>;

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const SECRET = Buffer.alloc(32, 7).toString("base64");
const NOW = new Date("2026-12-10T12:00:00Z"); // Thu 10:00 ST
const SATURDAY = "2026-12-12";
const OWN_KEY = `lap_${"a".repeat(40)}`;
const NSE = 67109944;
const ENEMY = 67190001;

let db: Db;
let nse = 0;
let officer = "";
/** Each by-tag call: the server, the tag and the key it was sent on (undefined: LAP_API_KEY). */
let calls: { server: number; tag: string; apiKey: string | undefined }[] = [];

const alliance = (tag: string): AllianceSnapshotInput => ({
  unionId: ENEMY,
  tag,
  name: "Zeta Example",
  memberCount: 1,
  totalPower: 1000,
  totalKills: 10,
  members: [{ uid: 9, name: "Wren", power: 1000, kills: 10, lv: 20 }],
  serverRank: null,
  level: null,
  sourceUpdatedAt: NOW,
  cached: false,
  sid: 328,
  quota: { limit: 1000, used: 1, remaining: 999 },
  raw: {},
});

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db, { ...TEST_ENV, WORKSPACE_KEYS_SECRET: SECRET });
  test.clock.now = NOW;
  calls = [];
  test.ctx.v1.fetchAllianceByTag = async (server, tag, onAttempt, _signal, options) => {
    onAttempt?.(0);
    calls.push({ server, tag, apiKey: options?.apiKey });
    return alliance(tag);
  };
  holder.ctx = test.ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: NSE, slug: "nse", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  nse = ws?.id ?? 0;
  const switches = { shield_check: true };
  await db
    .insert(workspaceFeatures)
    .values({ workspaceId: nse, switches, allianceSwitches: switches });
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: nse, discordUserId: "u-1", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, nse, user?.id ?? 0, NOW, null, "officer")).token;
  await db.insert(dailyReads).values({
    day: "2026-12-09",
    startedAt: new Date("2026-12-10T01:30:00Z"),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
});

const saveKey = () =>
  db.insert(workspaceKeys).values({
    workspaceId: nse,
    ...sealKey(SECRET, nse, OWN_KEY),
    status: "ok",
    statusAt: NOW,
    quotaRemaining: 900,
  });

const post = async (body: Record<string, unknown>) => {
  const res = await route.POST(
    new Request(`${ORIGIN}/api/w/nse/raid-opponent`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${officer}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );
  return [res.status, await res.json()];
};

/** The tag of the raid's current opponent (no `cleared_at`), or null. */
const current = async () => {
  const rows = await db
    .select({ tag: raidOpponents.tag })
    .from(raidOpponents)
    .where(
      and(
        eq(raidOpponents.workspaceId, nse),
        eq(raidOpponents.saturday, SATURDAY),
        isNull(raidOpponents.clearedAt),
      ),
    );
  return rows[0]?.tag ?? null;
};

describe("POST /api/w/[slug]/raid-opponent (issue 861)", () => {
  it("sets the opponent after one read by tag on the alliance's own key; clear and Undo need no call", async () => {
    await saveKey();
    const set = { action: "set", saturday: SATURDAY, server: 328, tag: "ZZZ" };
    expect(await post(set)).toEqual([200, { undo: null }]);
    expect(calls).toEqual([{ server: 328, tag: "ZZZ", apiKey: OWN_KEY }]);
    expect(await current()).toBe("ZZZ");
    const [status, cleared] = await post({ action: "clear", saturday: SATURDAY });
    expect(status).toBe(200);
    expect(await current()).toBeNull();
    expect(await post({ action: "undo", saturday: SATURDAY, id: cleared.undo })).toEqual([
      200,
      { undo: null },
    ]);
    expect(await current()).toBe("ZZZ");
    expect(calls).toHaveLength(1);
  });

  it("refuses with no_key and sends nothing when the workspace has no key of its own", async () => {
    const set = { action: "set", saturday: SATURDAY, server: 328, tag: "ZZZ" };
    expect(await post(set)).toEqual([409, { code: "no_key" }]);
    expect(calls).toEqual([]);
    expect(await current()).toBeNull();
  });
});
