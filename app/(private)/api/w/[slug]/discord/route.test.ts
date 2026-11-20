// POST /api/w/[slug]/discord (D129, issue 451): Check finds the bot with the bot token and registers in this
// workspace's server only the commands turned on; a webhook is saved only after Discord says it belongs to
// this server, sealed, and never answered back; a repeat makes no second check; publishing uses the saved
// webhook over WORKSPACE_DISCORD_WEBHOOKS, which stays the fallback; the test message pings no one. Discord is
// a stub: no real call is made. Invented ids and tokens only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { noticeChannels } from "@/lib/private/discord-webhooks";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceDiscord, workspaceWebhooks } from "@/lib/schema-discord";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const GUILD = "900000000000000101";
const OTHER_GUILD = "900000000000000202";
/** Built from a repeated phrase, so no scanner takes them for real webhooks. */
const hook = (token: string) =>
  `https://discord.com/api/webhooks/900000000000000303/${`${token}-test-`.repeat(4)}`;
const OURS = hook("ours");
const THEIRS = hook("theirs");
const SITE = "https://discord.com/api/webhooks/900000000000000404/site-fallback-test-token";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_KEYS_SECRET: Buffer.alloc(32, 9).toString("base64"),
  DISCORD_CLIENT_ID: "900000000000000505",
  DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  DISCORD_BOT_TOKEN: "bot-token-for-tests-only",
  DISCORD_API_BASE_URL: "https://discord.test/api",
  WORKSPACE_DISCORD_WEBHOOKS: {
    nse: { members: { url: SITE, name: "site-members", forum: false } },
  },
};

let db: Db;
let officer = "";
let workspaceId = 0;
/** Every call the stub received, and whether the bot is in the server. */
let calls: { method: string; url: string; body: string }[] = [];
let botIn = false;

function stubDiscord(): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: typeof init?.body === "string" ? init.body : "" });
    if (url.endsWith("/oauth2/token")) return Response.json({ access_token: "bearer-test" });
    if (url.endsWith(`/guilds/${GUILD}`)) {
      return botIn ? Response.json({ id: GUILD }) : new Response("", { status: 403 });
    }
    // A webhook's GET answers its server; a PUT of commands or a post answers a plain ok.
    const guild = url.includes("theirs") ? OTHER_GUILD : GUILD;
    return Response.json({ id: "1", guild_id: guild });
  };
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const ctx = testContext(db, ENV).ctx;
  ctx.fetch = stubDiscord();
  holder.ctx = ctx;
  calls = [];
  botIn = false;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67109944, slug: "nse", discordGuildId: GUILD, leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "u-1", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
});

const post = (body: unknown) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/discord`, {
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

const save = (url: string, requestId = crypto.randomUUID()) =>
  post({
    action: "webhook",
    channel: "members",
    url,
    name: "#town-square",
    forum: false,
    requestId,
  });

const access = async () => {
  const a = await requireWorkspace(db, "nse", { get: () => ({ value: officer }) }, T0);
  if (!a.ok) throw new Error("no access");
  return a;
};

describe("POST /api/w/[slug]/discord (D129)", () => {
  it("Check: says the bot is missing, then registers only the commands on, in this server only", async () => {
    const missing = await post({ action: "check" });
    expect([missing.status, await missing.json()]).toEqual([409, { code: "bot_missing" }]);
    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);

    botIn = true;
    const found = await post({ action: "check" });
    // A new alliance has the paid Translate commands off (D126): only Send to LAPTracker is registered.
    expect(await found.json()).toEqual({ firstSeen: true, commands: ["Send to LAPTracker"] });
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((p) => p.url)).toEqual([
      `https://discord.test/api/applications/${ENV.DISCORD_CLIENT_ID}/guilds/${GUILD}/commands`,
    ]);
    expect(JSON.parse(puts[0]?.body ?? "")).toEqual([{ name: "Send to LAPTracker", type: 3 }]);
    const [state] = await db.select().from(workspaceDiscord);
    expect(state?.commands).toEqual(["Send to LAPTracker"]);
    expect(await (await post({ action: "check" })).json()).toMatchObject({ firstSeen: false });
  });

  it("refuses a webhook of another server, and saves its own sealed, never answering the URL", async () => {
    const theirs = await save(THEIRS);
    expect([theirs.status, await theirs.json()]).toEqual([422, { code: "wrong_server" }]);
    expect(await db.select().from(workspaceWebhooks)).toEqual([]);

    const ours = await save(OURS);
    const text = await ours.text();
    expect(JSON.parse(text)).toEqual({
      channels: [
        { channel: "leaders", state: "none", name: null },
        { channel: "members", state: "set", name: "town-square" },
      ],
    });
    expect(text).not.toContain("ours-test");
    const [row] = await db.select().from(workspaceWebhooks);
    expect(JSON.stringify(row)).not.toContain("ours-test");
    // The check went to the API base (a stub here), and posted nothing.
    const gets = calls.filter((c) => c.url.includes("/webhooks/"));
    expect(
      gets.map((c) => [c.method, c.url.startsWith("https://discord.test/api/webhooks/")]),
    ).toEqual([
      ["GET", true],
      ["GET", true],
    ]);
  });

  it("makes no second check for a repeat of a save's request id (D100)", async () => {
    const id = crypto.randomUUID();
    expect((await save(OURS, id)).status).toBe(200);
    expect((await save(OURS, id)).status).toBe(200);
    expect(calls.filter((c) => c.url.includes("/webhooks/"))).toHaveLength(1);
  });

  it("posts to the saved webhook over the site's, and back to the site's after Remove", async () => {
    expect((await noticeChannels(db, await access(), ENV)).members?.url).toBe(SITE);
    await save(OURS);
    expect((await noticeChannels(db, await access(), ENV)).members).toEqual({
      url: OURS,
      name: "town-square",
      forum: false,
    });
    await post({ action: "remove_webhook", channel: "members" });
    expect((await noticeChannels(db, await access(), ENV)).members?.url).toBe(SITE);
  });

  it("sends one test message that pings no one, and logs no webhook", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await save(OURS);
    calls = [];
    const res = await post({ action: "test", channel: "members" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith(OURS)).toBe(true);
    expect(JSON.parse(calls[0]?.body ?? "")).toMatchObject({ allowed_mentions: { parse: [] } });
    expect(JSON.stringify(log.mock.calls)).not.toContain("ours-test");
    log.mockRestore();
  });
});
