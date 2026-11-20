// Issue 471's isolation suite, extended to a new alliance's way in (D130, issue 453): an invite never attaches
// to another workspace (its alliance's, or one on the server picked), a request's status secret opens only that
// request, and a server another workspace uses cannot be picked. Bravo's rows are identical after each try.
// Invented ids and names only; Discord is the invite's stub.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { createInvitedWorkspace, pickGuild } from "../repo/alliance-invites";
import { saveWorkspace } from "../repo/workspaces";
import { workspaces } from "../schema";
import { allianceInvites } from "../schema-invites";
import { ownedRows } from "../workspace-data.test-helpers";
import { requestView, submitRequest } from "./access-request";
import { inviteStep, type InviteInput } from "./invite-steps";
import {
  browser,
  deps,
  discord,
  GUILD,
  INVITE_COOKIE,
  OTHER_GUILD,
  openedInvite,
  R5_ROLE,
  signInThrough,
  WACK,
} from "./invite.test-helpers";

/** Bravo: another tracked alliance's workspace, on the server the invited person also manages. */
const BRAVO_UNION = 67110335;

let db: Db;
let bravo = { id: 0, unionId: BRAVO_UNION };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  discord.reset();
  await saveWorkspace(db, {
    unionId: BRAVO_UNION,
    slug: "bravo",
    discordGuildId: OTHER_GUILD,
    leaderRoleIds: ["700000000000000299"],
  });
  const [row] = await db.select({ id: workspaces.id }).from(workspaces);
  bravo = { id: row?.id ?? 0, unionId: BRAVO_UNION };
});

const finish: InviteInput = { action: "finish", leader_role_ids: [R5_ROLE], member_role_ids: [] };

describe("a new alliance's way in, between workspaces (issue 471, D130)", () => {
  it("refuses a server another workspace already uses", async () => {
    const before = await ownedRows(db, bravo);
    const b = await openedInvite(db);
    await signInThrough(db, b);
    const picked = await inviteStep(db, deps(), b.jar, { action: "server", guild_id: OTHER_GUILD });
    expect(picked).toEqual({ ok: false, code: "taken" });
    expect(await ownedRows(db, bravo)).toEqual(before);
  });

  it("never attaches an invite to another workspace: its alliance's, or the server's", async () => {
    const before = await ownedRows(db, bravo);
    // An invite for Bravo's own alliance cannot edit Bravo.
    const own = await openedInvite(db, T0, BRAVO_UNION);
    await signInThrough(db, own);
    await inviteStep(db, deps(), own.jar, { action: "server", guild_id: GUILD });
    expect(await inviteStep(db, deps(), own.jar, finish)).toEqual({ ok: false, code: "has_desk" });
    // WACK's invite whose server Bravo took after it was picked is refused at the end.
    const wack = await openedInvite(db, T0, WACK);
    await signInThrough(db, wack);
    await inviteStep(db, deps(), wack.jar, { action: "server", guild_id: GUILD });
    await db.update(workspaces).set({ discordGuildId: GUILD });
    expect(await inviteStep(db, deps(), wack.jar, finish)).toEqual({ ok: false, code: "taken" });
    await db.update(workspaces).set({ discordGuildId: OTHER_GUILD });
    expect(await ownedRows(db, bravo)).toEqual(before);
    expect(await db.select({ slug: workspaces.slug }).from(workspaces)).toEqual([
      { slug: "bravo" },
    ]);
  });

  it("binds each step to the account that claimed the invite: a second account can neither pick nor finish", async () => {
    const first = await openedInvite(db);
    await signInThrough(db, first);
    // The first account's claim, as a step read it, before a second account signs in on the same invite.
    const [seen] = await db.select().from(allianceInvites);
    const firstClaim = { discordId: seen?.claimedBy ?? "", claimHash: seen?.claimHash ?? "" };
    const second = browser();
    second.take([`${INVITE_COOKIE}=${first.cookies.get(INVITE_COOKIE)}`]);
    discord.account = "700000000000000002";
    await signInThrough(db, second);
    // A write checked against the first claim changes nothing once the second holds it.
    expect(await pickGuild(db, seen?.id ?? 0, firstClaim, GUILD, T0)).toBe(false);
    const made = await createInvitedWorkspace(
      db,
      {
        inviteId: seen?.id ?? 0,
        unionId: WACK,
        slug: "wack",
        guildId: GUILD,
        leaderRoleIds: [R5_ROLE],
        memberRoleIds: [],
        discordUserId: firstClaim.discordId,
        displayName: "first",
        claimHash: firstClaim.claimHash,
      },
      T0,
    );
    expect(made).toEqual({ ok: false, code: "closed" });
    // Once the second account picked the server, the first browser gets nowhere either.
    expect(await inviteStep(db, deps(), second.jar, { action: "server", guild_id: GUILD })).toEqual(
      {
        ok: true,
      },
    );
    for (const step of [{ action: "server", guild_id: GUILD } as const, finish]) {
      expect(await inviteStep(db, deps(), first.jar, step)).toEqual({
        ok: false,
        code: "signed_out",
      });
    }
    expect(await db.select({ slug: workspaces.slug }).from(workspaces)).toEqual([
      { slug: "bravo" },
    ]);
  });

  it("opens only the request whose status secret it is", async () => {
    const mine = await submitRequest(
      db,
      { union_id: WACK, name: "Vellamo Rook", role: "r5" },
      "203.0.113.30",
      T0,
    );
    const theirs = await submitRequest(
      db,
      { union_id: 67110584, name: "Ilmari Ash", role: "r4" },
      "203.0.113.31",
      T0,
    );
    if (!mine.ok || !theirs.ok) throw new Error("refused");
    expect(await requestView(db, mine.credential)).toMatchObject({ player: "Vellamo Rook" });
    const [theirId] = theirs.credential.split(".");
    const [, mySecret] = mine.credential.split(".");
    expect(await requestView(db, `${theirId}.${mySecret}`)).toBeNull();
  });
});
