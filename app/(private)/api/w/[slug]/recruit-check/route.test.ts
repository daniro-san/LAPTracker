// POST /api/w/[slug]/recruit-check and the recruit check's facts (issue 833): a stored player costs no call; an
// unstored one is read once on the workspace's own key and kept (D132); the 21st new read of a UTC day is
// refused; a member's session and a switch turned off are refused; another workspace's key is never used;
// the facts carry no private roster key. Stubs only, no upstream call; invented names and values.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { recruitFacts } from "@/lib/private/recruit-check";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { findBlockedKeys } from "@/lib/queries/blocked-keys";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { workspaceKeys } from "@/lib/schema-keys";
import { playerReads } from "@/lib/schema-squads";
import { playerAnswer } from "@/lib/squads.test-helpers";
import { PRIVATE_MARKERS, seedRoster } from "@/lib/workspace-data.test-helpers";
import { sealKey } from "@/lib/workspace-keys";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const SECRET = Buffer.alloc(32, 7).toString("base64");
const NOW = new Date("2026-11-20T12:00:00Z");
const OWN_KEY = `lap_${"a".repeat(40)}`;
const OTHER_KEY = `lap_${"b".repeat(40)}`;
const NSE = 67109944;
const OTHER = 67100002;

let db: Db;
let nse = 0;
let other = 0;
let officer = "";
let member = "";
/** Each /v1/players call: the uid and the key it was sent on (undefined: LAP_API_KEY). */
let calls: { uid: number; apiKey: string | undefined }[] = [];

async function workspace(slug: string, unionId: number, on: boolean) {
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const id = ws?.id ?? 0;
  // A new alliance's tracker features wait for the owner and the officers (D134).
  const switches = { recruit_check: on };
  await db
    .insert(workspaceFeatures)
    .values({ workspaceId: id, switches, allianceSwitches: switches });
  return id;
}

/** A saved key that reads now, sealed for its own workspace (D124). */
const saveKey = (workspaceId: number, key: string) =>
  db.insert(workspaceKeys).values({
    workspaceId,
    ...sealKey(SECRET, workspaceId, key),
    status: "ok",
    statusAt: NOW,
    quotaRemaining: 900,
  });

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db, { ...TEST_ENV, WORKSPACE_KEYS_SECRET: SECRET });
  test.clock.now = NOW;
  calls = [];
  test.ctx.v1.fetchPlayer = async (uid, onAttempt, _signal, options) => {
    onAttempt?.(0);
    calls.push({ uid, apiKey: options?.apiKey });
    return playerAnswer(uid, [], null, {
      history: [
        {
          t: new Date("2026-11-19T08:00:00Z"),
          power: 4_200_000,
          kills: 900,
          level: 20,
          vip: 3,
          unionId: 67100009,
          unionAbbr: "QQQ",
          sid: 1,
          changeFlags: null,
          nick: "Wren Example",
        },
      ],
      raw: { uid, x: 98765, y: 54321, avatar_url: "https://avatar.example.test/w.png" },
    });
  };
  holder.ctx = test.ctx;
  nse = await workspace("nse", NSE, true);
  other = await workspace("other", OTHER, true);
  const users = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId: nse, discordUserId: "u-1", displayName: "Ana" },
      { workspaceId: nse, discordUserId: "u-2", displayName: "Bram" },
    ])
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, nse, users[0]?.id ?? 0, NOW, null, "officer")).token;
  member = (await createSession(db, nse, users[1]?.id ?? 0, NOW, null, "member")).token;
  await saveKey(other, OTHER_KEY);
});

const post = (uid: number, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/recruit-check`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify({ uid }),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

const answer = async (res: Response) => [res.status, await res.json()];

async function access(): Promise<WorkspaceAccess> {
  const found = await requireWorkspace(db, "nse", { get: () => ({ value: officer }) }, NOW);
  if (!found.ok) throw new Error(found.reason);
  return found;
}

describe("the recruit check (issue 833)", () => {
  it("shows a stored player from the daily rosters without a tracker call", async () => {
    await saveKey(nse, OWN_KEY);
    await seedRoster(db, 67100009);
    expect(await answer(await post(101))).toEqual([200, { called: false }]);
    expect(calls).toEqual([]);
    const facts = await recruitFacts(db, await access(), 101, NOW);
    expect(facts).toMatchObject({ uid: 101, name: "Ana Example", might: { to: { value: 1000 } } });
  });

  it("reads an unstored player once on the workspace's own key, and keeps the answer under its alliance", async () => {
    await saveKey(nse, OWN_KEY);
    expect(await answer(await post(202))).toEqual([200, { called: true }]);
    expect(calls).toEqual([{ uid: 202, apiKey: OWN_KEY }]);
    const kept = await db.select({ unionId: playerReads.unionId }).from(playerReads);
    expect(kept).toEqual([{ unionId: NSE }]);
    // Kept now: the next look-up costs nothing.
    expect(await answer(await post(202))).toEqual([200, { called: false }]);
    expect(calls).toHaveLength(1);
    const facts = await recruitFacts(db, await access(), 202, NOW);
    expect(facts).toMatchObject({ name: "Wren Example", alliance: { tag: "QQQ" } });
  });

  it("refuses the 21st new read of the UTC day, and sends nothing for it", async () => {
    await saveKey(nse, OWN_KEY);
    for (let uid = 301; uid <= 320; uid++) expect((await post(uid)).status).toBe(200);
    expect(await answer(await post(321))).toEqual([429, { code: "cap_reached" }]);
    expect(calls).toHaveLength(20);
  });

  it("refuses a member's session", async () => {
    await saveKey(nse, OWN_KEY);
    expect(await answer(await post(202, member))).toEqual([401, { code: "signed_out" }]);
    expect(calls).toEqual([]);
  });

  it("is refused while its switch is off", async () => {
    await saveKey(nse, OWN_KEY);
    await db.update(workspaceFeatures).set({ allianceSwitches: { recruit_check: false } });
    expect(await answer(await post(202))).toEqual([403, { code: "turned_off" }]);
    expect(calls).toEqual([]);
  });

  it("never reads on another workspace's key or on LAP_API_KEY", async () => {
    // Only the other workspace saved a key.
    expect(await answer(await post(202))).toEqual([409, { code: "no_key" }]);
    expect(calls).toEqual([]);
  });

  it("carries no private roster key in the facts", async () => {
    await saveKey(nse, OWN_KEY);
    await seedRoster(db, 67100009);
    await post(202);
    for (const uid of [101, 202]) {
      const facts = await recruitFacts(db, await access(), uid, NOW);
      expect(findBlockedKeys(facts)).toEqual([]);
      const text = JSON.stringify(facts);
      for (const marker of PRIVATE_MARKERS) expect(text).not.toContain(marker);
    }
  });
});
