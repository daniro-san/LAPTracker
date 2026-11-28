// POST /api/w/[slug]/glossary (#832, D81 amendment): Alliance settings → Glossary. Officers only; the list is
// cleaned and capped; Undo is a save of the list before; off while no translating feature is on, and nothing
// is sent to analytics. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { glossaryView, glossaryWords } from "@/lib/private/glossary";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
let db: Db;
let workspaceId = 0;
let officer = "";
let member = "";
/** Every payload sent to PostHog (analytics on, as in production). */
let payloads: string[] = [];

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const ctx = testContext(db, {
    ...TEST_ENV,
    VERCEL_ENV: "production",
    POSTHOG_KEY: "phc_test",
  }).ctx;
  payloads = [];
  ctx.fetch = async (_input, init) => {
    payloads.push(String(init?.body ?? ""));
    return Response.json({});
  };
  holder.ctx = ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67109944, slug: "nse", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  workspaceId = ws?.id ?? 0;
  // The owner allows Translate; a new alliance starts with every translating feature off (D126).
  await db
    .insert(workspaceFeatures)
    .values({ workspaceId, switches: { notice_translate: true }, allianceSwitches: {} });
  const users = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId, discordUserId: "u-1", displayName: "Ana" },
      { workspaceId, discordUserId: "u-2", displayName: "Bram" },
    ])
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, workspaceId, users[0]?.id ?? 0, T0, null, "officer")).token;
  member = (await createSession(db, workspaceId, users[1]?.id ?? 0, T0, null, "member")).token;
});

const post = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/glossary`, {
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

const answer = async (res: Response) => [res.status, await res.json()];

describe("POST /api/w/[slug]/glossary (#832)", () => {
  it("saves an officer's list cleaned, and a member's session cannot", async () => {
    expect(await answer(await post({ words: ["  [ZZZ] ", "Elixir   Scramble", "[zzz]"] }))).toEqual(
      [200, { words: ["[ZZZ]", "Elixir Scramble"] }],
    );
    expect(await glossaryWords(db, workspaceId)).toEqual(["[ZZZ]", "Elixir Scramble"]);
    expect(await answer(await post({ words: ["Hacked"] }, member))).toEqual([
      401,
      { code: "signed_out" },
    ]);
    expect(await glossaryWords(db, workspaceId)).toEqual(["[ZZZ]", "Elixir Scramble"]);
  });

  it("undoes a removal by saving the list before, and sends nothing to analytics", async () => {
    const before = ["[ZZZ]", "Elixir Scramble"];
    await post({ words: before });
    await post({ words: ["[ZZZ]"] });
    expect(await glossaryWords(db, workspaceId)).toEqual(["[ZZZ]"]);
    await post({ words: before });
    expect(await glossaryWords(db, workspaceId)).toEqual(before);
    expect(payloads.join()).not.toMatch(/ZZZ|Elixir/);
  });

  it("refuses an invalid word and a list over 100 words, each with its own code", async () => {
    for (const bad of ["", "   ", "x".repeat(41), "{G1}", "bell\u0007"]) {
      expect(await answer(await post({ words: ["Fine", bad] }))).toEqual([
        400,
        { code: "invalid" },
      ]);
    }
    const hundred = Array.from({ length: 100 }, (_, i) => `Word${i}`);
    expect((await post({ words: hundred })).status).toBe(200);
    expect(await answer(await post({ words: [...hundred, "One more"] }))).toEqual([
      400,
      { code: "too_many" },
    ]);
    expect(await glossaryWords(db, workspaceId)).toEqual(hundred);
  });

  it("is hidden and refused while no translating feature is on, and the saved list stays", async () => {
    await post({ words: ["[ZZZ]"] });
    await db.update(workspaceFeatures).set({ switches: { notice_translate: false } });
    expect(await answer(await post({ words: [] }))).toEqual([403, { code: "turned_off" }]);
    expect(await glossaryWords(db, workspaceId)).toEqual(["[ZZZ]"]);
    const access = { features: { on: new Set<string>() }, workspaceId };
    expect(await glossaryView(db, access as never)).toBeNull();
  });
});
