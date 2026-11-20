// A new alliance's invite link (D130, issue 453): the link is a cookie at once and only its hash is stored;
// Discord's list keeps only the servers she may manage; the roles are read through the bot; the two roles are
// created with the alliance's own tag; finishing makes the workspace with her as officer, signs her in and
// registers the commands that are on; the link works once and expires. Discord is a stub (invite.test-helpers).
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { INVITE_MS } from "../repo/alliance-invites";
import { workspaces, workspaceUsers } from "../schema";
import { allianceInvites } from "../schema-invites";
import { requireWorkspace } from "./access";
import { inviteView, openInviteLink } from "./invite";
import { inviteStep, type InviteInput } from "./invite-steps";
import {
  deps,
  discord,
  env,
  GUILD,
  HER,
  MEMBER_ROLE,
  NOT_MANAGED,
  openedInvite,
  R5_ROLE,
  signInThrough,
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
    const later = new Date(T0.getTime() + INVITE_MS);
    expect(await inviteView(db, b.jar, env, later)).toEqual({
      state: "closed",
      why: "expired",
      slug: null,
    });
    expect(await inviteStep(db, deps(later), b.jar, { action: "roles" })).toEqual({
      ok: false,
      code: "signed_out",
    });
  });
});
