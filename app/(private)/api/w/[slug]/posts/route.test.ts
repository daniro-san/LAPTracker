// POST /api/w/[slug]/posts (#713 part C, D159): Alliance settings → Posts. It answers the cleaned title, and
// each refusal its own status and code: a post the owner does not allow, a channel the catalog does not offer
// for it, a title past 80 graphemes, the 31st save in 15 minutes, a member's session. A save counts as
// `ws_action` `posts` with `post`: `turn_on` or `turn_off` when the switch changed, `save` for anything else,
// nothing when nothing changed, and never the title. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { POST_CATALOG } from "@/lib/post-catalog";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspacePosts, type PostChannel } from "@/lib/schema-discord";
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

const week = { post: "week", on: true, channel: "members", title: "", language: "en" };

const post = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/posts`, {
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

describe("POST /api/w/[slug]/posts (D159)", () => {
  it("answers the cleaned title, and each refusal with its own status and code", async () => {
    expect(await answer(await post({ ...week, title: "  Our\n week " }))).toEqual([
      200,
      { post: "week", on: true, title: "Our week" },
    ]);
    expect(await db.select().from(workspacePosts)).toMatchObject([
      { postKey: "week", on: true, channel: "members", title: "Our week", language: "en" },
    ]);
    // 80 graphemes once cleaned are kept, 81 refused.
    expect((await post({ ...week, title: ` ${"x".repeat(80)}\u200B ` })).status).toBe(200);
    expect(await answer(await post({ ...week, title: "x".repeat(81) }))).toEqual([
      400,
      { code: "too_long" },
    ]);
    expect(await answer(await post({ ...week, channel: "shield" }))).toEqual([
      400,
      { code: "bad_request" },
    ]);
    expect(await answer(await post(week, member))).toEqual([401, { code: "signed_out" }]);
    // The site's owner does not allow the post for this alliance (D134).
    await db.insert(workspaceFeatures).values({ workspaceId, switches: { post_week: false } });
    expect(await answer(await post(week))).toEqual([403, { code: "not_allowed" }]);
  });

  it("refuses a channel the catalog does not offer for the post", async () => {
    const entry = POST_CATALOG.week as { channels: readonly PostChannel[] };
    const offered = entry.channels;
    // A post for the leaders only, as the weekly members summary will be.
    entry.channels = ["leaders"];
    try {
      expect(await answer(await post(week))).toEqual([400, { code: "bad_channel" }]);
      expect((await post({ ...week, channel: "leaders" })).status).toBe(200);
    } finally {
      entry.channels = offered;
    }
  });

  it("refuses the 31st save in 15 minutes with 429", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await post({ ...week, title: `Week ${i}` })).status).toBe(200);
    }
    expect(await answer(await post({ ...week, title: "One more" }))).toEqual([
      429,
      { code: "rate_limited" },
    ]);
  });

  it("counts turn_on, save and turn_off with the post, nothing for the same values, never the title", async () => {
    expect((await post({ ...week, title: "Hold the line" })).status).toBe(200);
    await vi.waitFor(() => expect(payloads).toHaveLength(1));
    // The same values again: saved, nothing changed, no event.
    expect((await post({ ...week, title: " Hold the line " })).status).toBe(200);
    expect((await post({ ...week, title: "Hold the line", channel: "leaders" })).status).toBe(200);
    await vi.waitFor(() => expect(payloads).toHaveLength(2));
    expect(
      (await post({ ...week, on: false, channel: "leaders", title: "Hold the line" })).status,
    ).toBe(200);
    await vi.waitFor(() => expect(payloads).toHaveLength(3));
    const actions = payloads.map((p) => /"action":"(\w+)"/.exec(p)?.[1]);
    expect(actions).toEqual(["turn_on", "save", "turn_off"]);
    for (const p of payloads) {
      expect(p).toContain('"feature":"posts"');
      expect(p).toContain('"post":"week"');
    }
    expect(payloads.join()).not.toContain("Hold the line");
  });
});
