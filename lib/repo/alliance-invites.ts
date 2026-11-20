// alliance_invites and access_requests (D130, issue 453): the owner's one-time links and the "Request a Desk"
// rows, plain reads and writes. The link's secret is made here and returned once; only its sha256 is stored.
// Who may use a link (the secret, the claim cookie, the Discord account) is checked in lib/private/invite.ts.
import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceUsers } from "../schema";
import {
  accessRequests,
  allianceInvites,
  type ClaimedRole,
  type InviteGuild,
  type RosterMatch,
} from "../schema-invites";

export type InviteRow = typeof allianceInvites.$inferSelect;
export type RequestRow = typeof accessRequests.$inferSelect;

/** An invite link works for 7 days (issue 453). */
export const INVITE_MS = 7 * 24 * 60 * 60_000;
/** Decided requests, and used, cancelled or expired invites, are deleted this long after (issue 453). */
export const KEEP_MS = 30 * 24 * 60 * 60_000;

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

/**
 * A new link for the alliance; earlier open links for it are cancelled, so one link at a time works.
 * Returns the credential `<id>.<secret>`, shown once.
 */
export async function createInvite(
  db: Db,
  unionId: number,
  now: Date,
): Promise<{ id: number; credential: string; expiresAt: Date }> {
  const raw = secret();
  const expiresAt = new Date(now.getTime() + INVITE_MS);
  await db
    .update(allianceInvites)
    .set({ cancelledAt: now })
    .where(and(eq(allianceInvites.unionId, unionId), openAt(now)));
  const [row] = await db
    .insert(allianceInvites)
    .values({ unionId, tokenHash: sha256(raw), createdAt: now, expiresAt })
    .returning({ id: allianceInvites.id });
  if (!row) throw new Error("invite insert returned no row");
  return { id: row.id, credential: `${row.id}.${raw}`, expiresAt };
}

/** Neither used, cancelled nor expired at `now`. */
const openAt = (now: Date) =>
  and(
    isNull(allianceInvites.usedAt),
    isNull(allianceInvites.cancelledAt),
    gt(allianceInvites.expiresAt, now),
  );

export async function findInvite(db: Db, id: number): Promise<InviteRow | null> {
  const [row] = await db.select().from(allianceInvites).where(eq(allianceInvites.id, id));
  return row ?? null;
}

/** /admin's Cancel: an open link stops working. */
export async function cancelInvite(db: Db, id: number, now: Date): Promise<boolean> {
  const rows = await db
    .update(allianceInvites)
    .set({ cancelledAt: now })
    .where(and(eq(allianceInvites.id, id), openAt(now)))
    .returning({ id: allianceInvites.id });
  return rows.length > 0;
}

/**
 * Who signed in through the link, and the servers they manage. Until a server is picked, signing in with
 * another account replaces the first (a wrong account is fixed by signing in again); after it, the account
 * that picked keeps the link and another gets false. The same account again gets a new claim.
 */
export async function claimInvite(
  db: Db,
  id: number,
  who: { discordId: string; name: string; claimHash: string; guilds: InviteGuild[] },
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(allianceInvites)
    .set({
      claimedBy: who.discordId,
      claimedName: who.name,
      claimHash: who.claimHash,
      guilds: who.guilds,
    })
    .where(
      and(
        eq(allianceInvites.id, id),
        openAt(now),
        or(
          isNull(allianceInvites.claimedBy),
          eq(allianceInvites.claimedBy, who.discordId),
          isNull(allianceInvites.guildId),
        ),
      ),
    )
    .returning({ id: allianceInvites.id });
  return rows.length > 0;
}

export async function pickGuild(db: Db, id: number, guildId: string, now: Date): Promise<void> {
  await db
    .update(allianceInvites)
    .set({ guildId })
    .where(and(eq(allianceInvites.id, id), openAt(now)));
}

export interface InvitedWorkspace {
  inviteId: number;
  unionId: number;
  slug: string;
  guildId: string;
  leaderRoleIds: string[];
  memberRoleIds: string[];
  /** The person who used the link: an officer through the allowlist, with no end (D130). */
  discordUserId: string;
  displayName: string;
}

/**
 * Uses the link and makes the workspace, in one transaction: the link only while open (so it works once),
 * the workspace only as a new row (never an edit of another alliance's), and its first officer. Returns the
 * workspace and officer ids, or why not; a server or address taken meanwhile is caught by the unique keys.
 */
export async function createInvitedWorkspace(
  db: Db,
  w: InvitedWorkspace,
  now: Date,
): Promise<
  { ok: true; workspaceId: number; userId: number } | { ok: false; code: "closed" | "taken" }
> {
  return db
    .transaction((tx) => useInvite(tx as unknown as Db, w, now))
    .catch((error: unknown) => {
      if (error instanceof Taken) return { ok: false as const, code: "taken" as const };
      throw error;
    });
}

/** Thrown inside the transaction so the link's use is undone with it. */
class Taken extends Error {}

async function useInvite(tx: Db, w: InvitedWorkspace, now: Date) {
  const used = await tx
    .update(allianceInvites)
    .set({ usedAt: now, createdSlug: w.slug, guilds: null })
    .where(and(eq(allianceInvites.id, w.inviteId), openAt(now)))
    .returning({ id: allianceInvites.id });
  if (used.length === 0) return { ok: false as const, code: "closed" as const };
  const [ws] = await tx
    .insert(workspaces)
    .values({
      unionId: w.unionId,
      slug: w.slug,
      discordGuildId: w.guildId,
      leaderRoleIds: w.leaderRoleIds,
      memberRoleIds: w.memberRoleIds,
    })
    .onConflictDoNothing()
    .returning({ id: workspaces.id });
  if (!ws) throw new Taken();
  const [user] = await tx
    .insert(workspaceUsers)
    .values({
      workspaceId: ws.id,
      discordUserId: w.discordUserId,
      displayName: w.displayName,
      lastLoginAt: now,
      allowlisted: true,
      allowlistAddedBy: "invite",
      allowlistExpiresAt: null,
    })
    .returning({ id: workspaceUsers.id });
  if (!user) throw new Error("workspace user insert returned no row");
  return { ok: true as const, workspaceId: ws.id, userId: user.id };
}

/** The addresses and servers already used, and the alliances that have a workspace. */
export async function takenWorkspaceKeys(db: Db) {
  return db
    .select({
      slug: workspaces.slug,
      guild: workspaces.discordGuildId,
      unionId: workspaces.unionId,
    })
    .from(workspaces);
}

export interface RequestInput {
  unionId: number;
  playerName: string;
  claimedRole: ClaimedRole;
  rosterMatch: RosterMatch;
  rosterRank: string | null;
  rosterSeenAt: Date | null;
}

/** A new request; returns its status credential `<id>.<secret>`, the requester's only way to its answer. */
export async function insertRequest(db: Db, input: RequestInput, now: Date): Promise<string> {
  const raw = secret();
  const [row] = await db
    .insert(accessRequests)
    .values({ ...input, statusHash: sha256(raw), createdAt: now })
    .returning({ id: accessRequests.id });
  if (!row) throw new Error("request insert returned no row");
  return `${row.id}.${raw}`;
}

export async function findRequest(db: Db, id: number): Promise<RequestRow | null> {
  const [row] = await db.select().from(accessRequests).where(eq(accessRequests.id, id));
  return row ?? null;
}

/** The owner's answer, once: an undecided request only. */
export async function decideRequest(
  db: Db,
  id: number,
  answer:
    { decision: "approved"; inviteId: number } | { decision: "declined"; reason: string | null },
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(accessRequests)
    .set({
      decision: answer.decision,
      decidedAt: now,
      ...(answer.decision === "approved"
        ? { inviteId: answer.inviteId }
        : { declineReason: answer.reason }),
    })
    .where(and(eq(accessRequests.id, id), isNull(accessRequests.decision)))
    .returning({ id: accessRequests.id });
  return rows.length > 0;
}

/** Deletes what is older than KEEP_MS past its end: decided requests, and closed invites. */
export async function purgeOldInvites(db: Db, now: Date): Promise<void> {
  const before = new Date(now.getTime() - KEEP_MS);
  await db
    .delete(accessRequests)
    .where(and(isNotNull(accessRequests.decidedAt), lt(accessRequests.decidedAt, before)));
  await db
    .delete(allianceInvites)
    .where(
      or(
        lt(allianceInvites.usedAt, before),
        lt(allianceInvites.cancelledAt, before),
        lt(allianceInvites.expiresAt, before),
      ),
    );
}
