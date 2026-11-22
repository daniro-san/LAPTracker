// POST /api/admin/workspaces/features (D126): every change needs the /admin PIN; "Copy settings from" gives the
// target the source's switches and caps as served (its defaults when it never had a row).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { settingsById } from "@/lib/repo/workspace-features";
import { saveWorkspace } from "@/lib/repo/workspaces";
import { workspaceDiscord } from "@/lib/schema-discord";
import { workspaceFeatures } from "@/lib/schema-features";
import { CODE_DEFAULTS } from "@/lib/workspace-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  // Invented alliances: 1 is OGs' workspace, 2 and 3 are new ones.
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["9"],
  });
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "2",
    leaderRoleIds: ["9"],
  });
  await saveWorkspace(db, {
    unionId: 67110000,
    slug: "abc",
    discordGuildId: "3",
    leaderRoleIds: ["9"],
  });
});

const post = (pin: string, body: unknown) =>
  route.POST(
    new Request("https://laptracker.test/api/admin/workspaces/features", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );
const settingsOf = async (id: number) => (await settingsById(db, id))?.settings;

/** Discord with the app's credentials: the token call answers, and every command PUT is kept, in order. */
function discordCalls() {
  const ctx = testContext(db, {
    ...TEST_ENV,
    DISCORD_CLIENT_ID: "900000000000000505",
    DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  }).ctx;
  const puts: { url: string; body: unknown }[] = [];
  ctx.fetch = async (input, init) => {
    if (String(input).endsWith("/oauth2/token")) return Response.json({ access_token: "b" });
    puts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json([]);
  };
  holder.ctx = ctx;
  return puts;
}

describe("POST /api/admin/workspaces/features (D126)", () => {
  it("changes nothing without the PIN", async () => {
    const turnOn = { action: "switch", workspace_id: 2, feature: "notice_translate", on: true };
    for (const pin of ["", "wrong-pin"]) {
      expect((await post(pin, turnOn)).status).toBe(401);
      expect((await post(pin, { action: "pause", allowance: "ai", paused: true })).status).toBe(
        401,
      );
    }
    expect(await db.select().from(workspaceFeatures)).toEqual([]);
    expect((await post(TEST_PIN, turnOn)).status).toBe(200);
    expect((await settingsOf(2))?.off).not.toContain("notice_translate");
  });

  it("copies another workspace's switches and caps, its defaults included", async () => {
    await post(TEST_PIN, { action: "switch", workspace_id: 2, feature: "thefts", on: false });
    await post(TEST_PIN, { action: "cap", workspace_id: 2, allowance: "ai", cap: 40 });
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 2 })).status).toBe(
      200,
    );
    expect(await settingsOf(3)).toEqual(await settingsOf(2));
    expect((await settingsOf(3))?.caps.ai).toBe(40);
    // From OGs, which never had a row: everything on, no cap.
    await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 1 });
    // The alliance's own switches are not copied: its tracker features wait for its officers.
    expect(await settingsOf(3)).toEqual({
      off: [],
      caps: { ai: null, translate: null },
      allianceOff: ["squads", "shield_check"],
    });
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 3 })).status).toBe(
      400,
    );
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 99 })).status).toBe(
      404,
    );
  });

  it("stores only what differs from the defaults, and Reset follows the default again (D134)", async () => {
    const stored = async () => (await settingsById(db, 2))?.stored;
    await post(TEST_PIN, { action: "switch", workspace_id: 2, feature: "squads", on: true });
    await post(TEST_PIN, { action: "cap", workspace_id: 2, allowance: "ai", cap: 40 });
    expect(await stored()).toMatchObject({ switches: { squads: true }, caps: { ai: 40 } });
    // Thefts allowed is the default already: nothing is stored.
    await post(TEST_PIN, { action: "switch", workspace_id: 2, feature: "thefts", on: true });
    await post(TEST_PIN, { action: "switch", workspace_id: 2, feature: "squads", on: null });
    await post(TEST_PIN, { action: "cap", workspace_id: 2, allowance: "ai", cap: "default" });
    expect(await stored()).toMatchObject({ switches: {}, caps: {} });
    // A new default reaches nse (on the default) and abc, but OGs keeps everything on.
    await post(TEST_PIN, { action: "default_switch", feature: "squads", on: true });
    await post(TEST_PIN, { action: "default_cap", allowance: "translate", cap: null });
    expect((await settingsOf(2))?.off).not.toContain("squads");
    expect((await settingsOf(3))?.caps.translate).toBeNull();
    expect((await settingsOf(1))?.off).toEqual([]);
    expect(
      (await post("", { action: "default_switch", feature: "squads", on: false })).status,
    ).toBe(401);
  });

  it("stores a cap equal to the default as none, so the alliance follows a new default (D134)", async () => {
    const atDefault = CODE_DEFAULTS.caps.ai ?? 0;
    await post(TEST_PIN, { action: "cap", workspace_id: 2, allowance: "ai", cap: atDefault });
    expect((await settingsById(db, 2))?.stored?.caps).toEqual({});
    await post(TEST_PIN, { action: "default_cap", allowance: "ai", cap: atDefault + 10 });
    expect((await settingsOf(2))?.caps.ai).toBe(atDefault + 10);
  });

  it("re-registers a server that had commands after a default for new alliances changes (D129, D134)", async () => {
    const puts = discordCalls();
    // nse's server has the one command its features allow; OGs keeps everything on, whatever the default.
    await db.insert(workspaceDiscord).values({ workspaceId: 2, commands: ["Send to LAPTracker"] });
    const on = { action: "default_switch", feature: "discord_translate_me", on: true };
    expect((await post(TEST_PIN, on)).status).toBe(200);
    expect(puts.map((p) => p.url.split("/guilds/")[1])).toEqual(["2/commands"]);
    expect(puts[0]?.body).toEqual([
      { name: "Send to LAPTracker", type: 3 },
      { name: "Translate for me", type: 3 },
    ]);
  });

  it("re-registers a server that had commands without the one turned off; leaves others alone (D129)", async () => {
    const puts = discordCalls();
    // OGs' server had all three commands; nse's never had any.
    const all = ["Send to LAPTracker", "Translate for me", "Translate for everyone"];
    await db.insert(workspaceDiscord).values({ workspaceId: 1, commands: all });
    const off = (id: number) =>
      post(TEST_PIN, {
        action: "switch",
        workspace_id: id,
        feature: "discord_translate_me",
        on: false,
      });
    expect((await off(1)).status).toBe(200);
    expect((await off(2)).status).toBe(200);
    expect(puts.map((p) => p.url.split("/guilds/")[1])).toEqual(["1/commands"]);
    expect(puts[0]?.body).toEqual([
      { name: "Send to LAPTracker", type: 3 },
      { name: "Translate for everyone", type: 3 },
    ]);
  });
});
