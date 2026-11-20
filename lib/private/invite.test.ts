// A new alliance's invite link (D130, issue 453): the link is a cookie at once and only its hash is stored;
// Discord's list keeps only the servers she may manage; the roles are read through the bot; the two roles are
// created with the alliance's own tag; finishing makes the workspace with her as officer, signs her in and
// registers the commands that are on; the link works once and expires. Discord is a stub (invite.test-helpers).
// Issue 500: the wrong-link count and the IP limit, the 30-step limit, and the transaction's own guards.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { IP_LIMIT, IP_WINDOW_MS } from "../auth";
import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  createInvite,
  createInvitedWorkspace,
  INVITE_MS,
  type InvitedWorkspace,
} from "../repo/alliance-invites";
import { currentCount } from "../repo/auth-attempts";
import { workspaces, workspaceUsers } from "../schema";
import { allianceInvites } from "../schema-invites";
import { requireWorkspace } from "./access";
import { inviteView, openInviteLink } from "./invite";
import { inviteStep, STEPS, type InviteInput } from "./invite-steps";
import {
  deps,
  discord,
  env,
  GUILD,
  HER,
  MEMBER_ROLE,
  NOT_MANAGED,
  openedInvite,
  OTHER_GUILD,
  R5_ROLE,
  signInThrough,
  WACK,
} from "./invite.test-helpers";
import { SESSION_COOKIE } from "./session";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  discord.reset();
});

/** The cookie a Set-Cookie header carries, as a jar. */
const sessionJar = (setCookie: string) => ({
  get: (name: string) =>
    name === SESSION_COOKIE ? { value: setCookie.split(";")[0]?.split("=")[1] ?? "" } : undefined,
});

describe("the invite link (D130)", () => {
  it("is traded for a cookie, stored only as a hash, and a wrong one is counted", async () => {
    const b = await openedInvite(db);
    const [row] = await db.select().from(allianceInvites);
    const secret = b.made.credential.split(".")[1] ?? "";
    expect(JSON.stringify(row)).not.toContain(secret);
    expect(await openInviteLink(db, `${row?.id}.${"x".repeat(43)}`, "203.0.113.9", T0)).toEqual({
      ok: false,
      code: "bad_link",
    });
    expect((await inviteView(db, b.jar, env, T0)).state).toBe("open");
  });

  it("lists only the servers she owns or may manage after the Discord sign-in", async () => {
    const b = await openedInvite(db);
    expect(await signInThrough(db, b)).toMatchObject({ kind: "redirect", location: "/w/invite" });
    const view = await inviteView(db, b.jar, env, T0);
    expect(view.state === "open" && view.signedIn?.guilds.map((g) => g.name)).toEqual([
      "Second Hall",
      "Wacky Hall",
    ]);
    const refused = await inviteStep(db, deps(), b.jar, {
      action: "server",
      guild_id: NOT_MANAGED,
    });
    expect(refused).toEqual({ ok: false, code: "not_yours" });
  });

  it("waits for the bot, then creates the roles with the alliance's own tag and gives her the leadership one", async () => {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    await inviteStep(db, deps(), b.jar, { action: "server", guild_id: GUILD });
    discord.botIn = false;
    expect(await inviteStep(db, deps(), b.jar, { action: "roles" })).toEqual({
      ok: false,
      code: "bot_missing",
    });
    discord.botIn = true;
    discord.canManageRoles = false;
    const create = {
      action: "create_roles",
      leader: "[WACK] Leadership",
      member: "[WACK] Members",
      give_me: true,
    } as const;
    expect(await inviteStep(db, deps(), b.jar, create)).toEqual({
      ok: false,
      code: "no_permission",
    });
    discord.canManageRoles = true;
    const made = await inviteStep(db, deps(), b.jar, create);
    expect(made).toMatchObject({ ok: true, gave: "ok" });
    const posted = discord.calls.filter((c) => c.method === "POST" && c.url.endsWith("/roles"));
    expect(posted.map((c) => JSON.parse(c.body))).toContainEqual({
      name: "[WACK] Leadership",
      permissions: "0",
      mentionable: false,
      hoist: false,
    });
    expect(
      discord.calls.some((c) => c.method === "PUT" && c.url.includes(`/members/${HER}/`)),
    ).toBe(true);
  });

  it("makes the workspace with her as officer, signs her in, registers the commands, and works once", async () => {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    await inviteStep(db, deps(), b.jar, { action: "server", guild_id: GUILD });
    const finish: InviteInput = {
      action: "finish",
      leader_role_ids: [R5_ROLE],
      member_role_ids: [MEMBER_ROLE],
    };
    const done = await inviteStep(db, deps(), b.jar, finish);
    expect(done).toMatchObject({ ok: true, slug: "wack" });
    const [ws] = await db.select().from(workspaces);
    expect(ws).toMatchObject({
      slug: "wack",
      discordGuildId: GUILD,
      leaderRoleIds: [R5_ROLE],
      memberRoleIds: [MEMBER_ROLE],
    });
    const [her] = await db
      .select()
      .from(workspaceUsers)
      .where(eq(workspaceUsers.discordUserId, HER));
    expect(her).toMatchObject({
      allowlisted: true,
      allowlistAddedBy: "invite",
      allowlistExpiresAt: null,
    });
    const access = await requireWorkspace(
      db,
      "wack",
      sessionJar("cookie" in done ? done.cookie : ""),
      T0,
    );
    expect(access).toMatchObject({ ok: true, slug: "wack" });
    expect(
      discord.calls.some((c) => c.method === "PUT" && c.url.includes(`/guilds/${GUILD}/commands`)),
    ).toBe(true);
    // Works once: the same browser, the same steps, nothing more.
    expect(await inviteStep(db, deps(), b.jar, finish)).toEqual({ ok: false, code: "closed" });
    expect(await db.select().from(workspaces)).toHaveLength(1);
    const [row] = await db.select().from(allianceInvites);
    expect(row?.guilds).toBeNull();
  });

  it("expires after 7 days", async () => {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    await inviteStep(db, deps(), b.jar, { action: "server", guild_id: GUILD });
    const later = new Date(T0.getTime() + INVITE_MS);
    expect(await inviteView(db, b.jar, env, later)).toEqual({
      state: "closed",
      why: "expired",
      slug: null,
    });
    // Signed in, with a server: only the expiry refuses.
    expect(await inviteStep(db, deps(later), b.jar, { action: "roles" })).toEqual({
      ok: false,
      code: "closed",
    });
  });

  it("reports a member role Discord refused, and a retry reuses the leadership role made before", async () => {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    await inviteStep(db, deps(), b.jar, { action: "server", guild_id: GUILD });
    const create = {
      action: "create_roles",
      leader: "[WACK] Leadership",
      member: "[WACK] Members",
      give_me: false,
    } as const;
    discord.refuse = "[WACK] Members";
    const first = await inviteStep(db, deps(), b.jar, create);
    expect(first).toMatchObject({ ok: true, memberFailed: "no_permission" });
    discord.refuse = null;
    const again = await inviteStep(db, deps(), b.jar, create);
    expect(again).toMatchObject({ ok: true, memberFailed: null });
    expect(discord.created.map((r) => r.name)).toEqual(["[WACK] Leadership", "[WACK] Members"]);
    const leaderId = discord.created[0]?.id;
    expect("roles" in again && again.roles?.[0]?.id).toBe(leaderId);
  });

  it("counts each wrong link under the address, and then refuses even the right link from it", async () => {
    const made = await createInvite(db, WACK, T0);
    const id = made.credential.split(".")[0];
    const ip = "203.0.113.9";
    for (let i = 0; i < IP_LIMIT; i++) {
      expect(await openInviteLink(db, `${id}.${"x".repeat(43)}`, ip, T0)).toEqual({
        ok: false,
        code: "bad_link",
      });
    }
    expect(await currentCount(db, `w:ip:${ip}`, IP_WINDOW_MS, T0)).toBe(IP_LIMIT);
    expect(await openInviteLink(db, made.credential, ip, T0)).toEqual({
      ok: false,
      code: "rate_limited",
    });
    expect((await openInviteLink(db, made.credential, "203.0.113.10", T0)).ok).toBe(true);
  });

  it("takes at most 30 steps every 15 minutes per invite, refused ones included", async () => {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    const step = { action: "server", guild_id: NOT_MANAGED } as const;
    for (let i = 0; i < STEPS; i++) {
      expect(await inviteStep(db, deps(), b.jar, step)).toEqual({ ok: false, code: "not_yours" });
    }
    expect(await inviteStep(db, deps(), b.jar, step)).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("making the workspace from an invite (D130): the transaction's own guards", () => {
  /** A signed-in invite and the workspace it would make, as finish passes it after its own checks. */
  async function ready(): Promise<InvitedWorkspace> {
    const b = await openedInvite(db);
    await signInThrough(db, b);
    const [row] = await db.select().from(allianceInvites);
    return {
      inviteId: row?.id ?? 0,
      unionId: WACK,
      slug: "wack",
      guildId: GUILD,
      leaderRoleIds: [R5_ROLE],
      memberRoleIds: [],
      discordUserId: row?.claimedBy ?? "",
      displayName: row?.claimedName ?? "",
      claimHash: row?.claimHash ?? "",
    };
  }
  const usedAt = async () => (await db.select().from(allianceInvites))[0]?.usedAt ?? null;

  it("uses an invite once: a second use makes nothing", async () => {
    const w = await ready();
    expect(await createInvitedWorkspace(db, w, T0)).toMatchObject({ ok: true });
    expect(await createInvitedWorkspace(db, w, T0)).toEqual({ ok: false, code: "closed" });
    expect(await db.select().from(workspaces)).toHaveLength(1);
    expect(await db.select().from(workspaceUsers)).toHaveLength(1);
  });

  it("makes nothing, and keeps the link unused, when the server was taken meanwhile", async () => {
    const w = await ready();
    await db
      .insert(workspaces)
      .values({ unionId: 67109944, slug: "nse", discordGuildId: GUILD, leaderRoleIds: [] });
    expect(await createInvitedWorkspace(db, w, T0)).toEqual({ ok: false, code: "taken" });
    expect(await usedAt()).toBeNull();
    expect(await db.select().from(workspaceUsers)).toEqual([]);
  });

  it("makes nothing, and keeps the link unused, when the address was taken meanwhile", async () => {
    const w = await ready();
    await db
      .insert(workspaces)
      .values({ unionId: 67109944, slug: "wack", discordGuildId: OTHER_GUILD, leaderRoleIds: [] });
    expect(await createInvitedWorkspace(db, w, T0)).toEqual({ ok: false, code: "taken" });
    expect(await usedAt()).toBeNull();
    expect(await db.select().from(workspaceUsers)).toEqual([]);
  });
});
