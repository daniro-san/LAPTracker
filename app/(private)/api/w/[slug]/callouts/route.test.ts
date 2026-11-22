// POST /api/w/[slug]/callouts (#713, D156): Alliance settings → Your line on our posts. Each refusal answers
// its own status and code; the 31st save in 15 minutes is refused; a save counts as `ws_action`
// `post_callout` / `save` only when the line changed, and the event never carries the text. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
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
    new Request(`${ORIGIN}/api/w/nse/callouts`, {
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

describe("POST /api/w/[slug]/callouts (D156)", () => {
  it("answers the cleaned line, and each refusal with its own status and code", async () => {
    expect(await answer(await post({ post: "thanks", callout: "  Thank you,\n family " }))).toEqual(
      [200, { post: "thanks", callout: "Thank you, family" }],
    );
    expect(await answer(await post({ post: "thanks", callout: "x".repeat(121) }))).toEqual([
      400,
      { code: "too_long" },
    ]);
    expect(await answer(await post({ post: "notices", callout: "Hi" }))).toEqual([
      400,
      { code: "bad_request" },
    ]);
    expect(await answer(await post({ post: "thanks", callout: "Hi" }, member))).toEqual([
      401,
      { code: "signed_out" },
    ]);
    // The officers turned the lines off in Alliance settings (D134).
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId, switches: {}, allianceSwitches: { post_callouts: false } });
    expect(await answer(await post({ post: "thanks", callout: "Hi" }))).toEqual([
      403,
      { code: "turned_off" },
    ]);
  });

  it("refuses the 31st save in 15 minutes with 429", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await post({ post: "garrison", callout: `Hold the gates ${i}` })).status).toBe(200);
    }
    expect(await answer(await post({ post: "garrison", callout: "One more" }))).toEqual([
      429,
      { code: "rate_limited" },
    ]);
  });

  it("counts a save as ws_action post_callout / save only when the line changed, never with the text", async () => {
    expect((await post({ post: "shield", callout: "Shields up, family" })).status).toBe(200);
    await vi.waitFor(() => expect(payloads.join()).toContain("post_callout"));
    expect(payloads).toHaveLength(1);
    // The same line again: saved, nothing changed, no event.
    expect((await post({ post: "shield", callout: " Shields up,  family " })).status).toBe(200);
    expect((await post({ post: "shield", callout: "Shields up, everyone" })).status).toBe(200);
    await vi.waitFor(() => expect(payloads).toHaveLength(2));
    const sent = payloads.join();
    expect(sent).toContain('"feature":"post_callout"');
    expect(sent).toContain('"action":"save"');
    expect(sent).not.toMatch(/Shields up|family|everyone/);
  });
});
