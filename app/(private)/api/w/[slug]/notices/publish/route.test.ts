// "Publish to Discord" (issue 345, D102): a notice goes to its audience's channel, never to the other; a
// repeat of the same request id posts nothing more; no message can mention anyone; a forum channel gets a
// post named after the notice with the rest inside it; without a channel nothing is sent.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext, TEST_ENV } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST: save } = await import("../route");
const { POST } = await import("./route");

const HOOK = "https://discord.com/api/webhooks/1/";
const env = (forum: boolean) => ({
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: {
    ogs: {
      members: { url: `${HOOK}members`, name: "guides-and-beyond", forum },
      leaders: { url: `${HOOK}leaders`, name: "notices", forum: false },
    },
  },
});

let db: Db;
let sent: { url: string; body: Record<string, unknown> }[];
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    { unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
    { unionId: 67109944, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
  ]);
  use(env(false));
});

/** The app context with `e`, and a Discord stand-in that keeps each post and opens a forum thread. */
function use(e: AppContext["env"]) {
  sent = [];
  holder.ctx = {
    ...testContext(db, e).ctx,
    fetch: async (input, init) => {
      sent.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json({ id: `m${sent.length}`, channel_id: "900" });
    },
  };
}

async function call(route: typeof POST, path: string, token: string, body: object) {
  const response = await route(
    new Request(`https://laptracker.test/api/w/ogs/${path}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function officer(): Promise<string> {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: "id-rook", displayName: "Rook" })
    .returning({ id: workspaceUsers.id });
  return (await createSession(db, 1, user?.id ?? 0, T0, null)).token;
}

/** A notice in English and French; `members` sets "Show to members". */
async function notice(token: string, members: boolean): Promise<number> {
  const made = await call(save, "notices", token, {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Garden rota", version: 0 },
      { field: "en", value: "Water the *roses* @everyone", version: 0 },
      { field: "fr", value: "Arrosez les roses.", version: 0 },
      { field: "for_members", value: String(members), version: 0 },
    ],
  });
  return made.json.id as number;
}

const publish = (token: string, id: number, requestId = randomUUID()) =>
  call(POST, "notices/publish", token, { id, languages: ["en", "fr"], requestId });

describe("POST /api/w/[slug]/notices/publish", () => {
  it("posts a members notice to the members' channel once, with no mention allowed", async () => {
    const token = await officer();
    const id = await notice(token, true);
    const requestId = randomUUID();
    const first = await publish(token, id, requestId);
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ audience: "members", languages: ["en", "fr"] });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`${HOOK}members?wait=true`);
    expect(sent[0]?.body.allowed_mentions).toEqual({ parse: [] });
    expect(String(sent[0]?.body.content)).toContain("**Garden rota**");
    expect(String(sent[0]?.body.content)).toContain("\\*roses\\* @​everyone");
    // The same request again (a double tap): the first answer, nothing posted.
    expect((await publish(token, id, requestId)).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("posts a leadership notice to the leaders' channel", async () => {
    const token = await officer();
    await publish(token, await notice(token, false));
    expect(sent.map((s) => s.url)).toEqual([`${HOOK}leaders?wait=true`]);
  });

  it("opens a forum post named after the notice and puts the rest inside it", async () => {
    use(env(true));
    const token = await officer();
    const id = await call(save, "notices", token, {
      requestId: randomUUID(),
      changes: [
        { field: "title", value: "Garden rota", version: 0 },
        { field: "en", value: "a".repeat(1500), version: 0 },
        { field: "fr", value: "b".repeat(1500), version: 0 },
        { field: "for_members", value: "true", version: 0 },
      ],
    });
    expect((await publish(token, id.json.id as number)).status).toBe(200);
    expect(sent.map((s) => s.url)).toEqual([
      `${HOOK}members?wait=true`,
      `${HOOK}members?wait=true&thread_id=900`,
    ]);
    expect(sent[0]?.body.thread_name).toBe("Garden rota");
    expect(sent[1]?.body.thread_name).toBeUndefined();
  });

  it("sends nothing when the audience's channel is not set up", async () => {
    use(TEST_ENV);
    const token = await officer();
    const answer = await publish(token, await notice(token, true));
    expect(answer).toEqual({ status: 409, json: { code: "not_set_up" } });
    expect(sent).toHaveLength(0);
  });
});
