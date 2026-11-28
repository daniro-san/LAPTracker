// POST /api/w/[slug]/branding (issue 462, D167): Alliance settings → Branding. The title is cleaned and capped at
// 40 characters, a default value is stored as none, the server's icon is read through the bot before that
// choice is kept, and a session of another workspace (or a member's) changes nothing. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
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

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const ICON = "a".repeat(32);
let db: Db;
let officer = "";
let member = "";
let elsewhere = "";
/** What Discord answers for the workspace's server: its icon hash, or none. */
let guildIcon: string | null = ICON;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  guildIcon = ICON;
  const ctx = testContext(db, { ...TEST_ENV, DISCORD_BOT_TOKEN: "bot-token" }).ctx;
  ctx.fetch = async () => Response.json({ id: "1", icon: guildIcon });
  holder.ctx = ctx;
  const made = await db
    .insert(workspaces)
    .values([
      { unionId: 67109944, slug: "nse", discordGuildId: "11111", leaderRoleIds: ["2"] },
      { unionId: 67109945, slug: "other", discordGuildId: "22222", leaderRoleIds: ["3"] },
    ])
    .returning({ id: workspaces.id });
  const [mine, theirs] = [made[0]?.id ?? 0, made[1]?.id ?? 0];
  const users = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId: mine, discordUserId: "u-1", displayName: "Ana" },
      { workspaceId: mine, discordUserId: "u-2", displayName: "Bram" },
      { workspaceId: theirs, discordUserId: "u-3", displayName: "Caro" },
    ])
    .returning({ id: workspaceUsers.id });
  const session = async (ws: number, i: number, tier: "officer" | "member") =>
    (await createSession(db, ws, users[i]?.id ?? 0, T0, null, tier)).token;
  officer = await session(mine, 0, "officer");
  member = await session(mine, 1, "member");
  elsewhere = await session(theirs, 2, "officer");
});

const save = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/branding`, {
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

const stored = async (slug: string) =>
  (await db.select().from(workspaces)).find((w) => w.slug === slug);

const look = { title: "", icon: "badge", accent: "burgundy" };

describe("POST /api/w/[slug]/branding (D167)", () => {
  it("cleans the title, keeps 40 characters and refuses 41", async () => {
    const res = await save({ ...look, title: "  Night\n<b>Watch</b>​  " });
    expect([res.status, await res.json()]).toMatchObject([
      200,
      { title: "Night bWatch/b", custom: true },
    ]);
    expect((await stored("nse"))?.brandTitle).toBe("Night bWatch/b");
    expect((await save({ ...look, title: "x".repeat(40) })).status).toBe(200);
    // 40 emoji are well past the old raw bound but are 40 characters: kept; 41 are refused as too long.
    expect((await save({ ...look, title: "😀".repeat(40) })).status).toBe(200);
    const emoji = await save({ ...look, title: "😀".repeat(41) });
    expect([emoji.status, await emoji.json()]).toEqual([400, { code: "too_long" }]);
    const long = await save({ ...look, title: "x".repeat(41) });
    expect([long.status, await long.json()]).toEqual([400, { code: "too_long" }]);
    expect((await stored("nse"))?.brandTitle).toBe("😀".repeat(40));
  });

  it("stores the defaults as none and a chosen look as it is", async () => {
    expect((await save({ title: "Crew", icon: "mark", accent: "teal" })).status).toBe(200);
    expect(await stored("nse")).toMatchObject({
      brandTitle: "Crew",
      brandIcon: "mark",
      brandAccent: "teal",
    });
    expect((await save(look)).status).toBe(200);
    expect(await stored("nse")).toMatchObject({
      brandTitle: null,
      brandIcon: null,
      brandAccent: null,
    });
    // Never a free colour or an icon of its own.
    expect((await save({ ...look, accent: "#ff0000" })).status).toBe(400);
    expect((await save({ ...look, icon: "upload" })).status).toBe(400);
  });

  it("keeps the Discord icon only when the bot reads one from the server", async () => {
    guildIcon = null;
    const none = await save({ ...look, icon: "discord" });
    expect([none.status, await none.json()]).toEqual([400, { code: "no_discord_icon" }]);
    expect((await stored("nse"))?.brandIcon).toBeNull();
    guildIcon = ICON;
    expect((await save({ ...look, icon: "discord" })).status).toBe(200);
    expect(await stored("nse")).toMatchObject({ brandIcon: "discord", discordIconHash: ICON });
  });

  it("lets only an officer of that workspace change it", async () => {
    const body = { title: "Taken over", icon: "mark", accent: "slate" };
    for (const token of [elsewhere, member, "no-session"]) {
      const res = await save(body, token);
      expect([res.status, await res.json()], token).toEqual([401, { code: "signed_out" }]);
    }
    expect(await stored("nse")).toMatchObject({
      brandTitle: null,
      brandIcon: null,
      brandAccent: null,
    });
    expect(await stored("other")).toMatchObject({ brandTitle: null, brandIcon: null });
  });
});
