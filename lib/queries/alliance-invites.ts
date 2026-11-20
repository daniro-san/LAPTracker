// /admin's New alliances card (D130, issue 453): the invite links and the requests, newest first. Owner only
// (PIN). Never a link's secret or hash, a claim, or the servers a person manages: their state in words.
import { desc } from "drizzle-orm";

import type { Db } from "../db";
import { accessRequests, allianceInvites } from "../schema-invites";

export interface AdminInvite {
  id: number;
  unionId: number;
  createdAt: Date;
  expiresAt: Date;
  state: "waiting" | "signedIn" | "server" | "used" | "expired" | "cancelled";
  /** The Discord name of who signed in through it, once someone did. */
  name: string | null;
  slug: string | null;
}

export interface AdminRequest {
  id: number;
  unionId: number;
  player: string;
  claimed: "r5" | "r4";
  rank: string | null;
  seenAt: Date | null;
  createdAt: Date;
  decision: "approved" | "declined" | null;
  decidedAt: Date | null;
}

type InviteFacts = Pick<
  typeof allianceInvites.$inferSelect,
  "usedAt" | "cancelledAt" | "expiresAt" | "guildId" | "claimedBy"
>;

/** An invite's state, as the owner reads it. */
export function inviteState(row: InviteFacts, now: Date): AdminInvite["state"] {
  if (row.usedAt) return "used";
  if (row.cancelledAt) return "cancelled";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.guildId) return "server";
  return row.claimedBy ? "signedIn" : "waiting";
}

export async function listInvites(db: Db, now: Date): Promise<AdminInvite[]> {
  const rows = await db
    .select({
      id: allianceInvites.id,
      unionId: allianceInvites.unionId,
      createdAt: allianceInvites.createdAt,
      expiresAt: allianceInvites.expiresAt,
      usedAt: allianceInvites.usedAt,
      cancelledAt: allianceInvites.cancelledAt,
      guildId: allianceInvites.guildId,
      claimedBy: allianceInvites.claimedBy,
      name: allianceInvites.claimedName,
      slug: allianceInvites.createdSlug,
    })
    .from(allianceInvites)
    .orderBy(desc(allianceInvites.createdAt));
  return rows.map((r) => ({
    id: r.id,
    unionId: r.unionId,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    state: inviteState(r, now),
    name: r.name,
    slug: r.slug,
  }));
}

export async function listRequests(db: Db): Promise<AdminRequest[]> {
  const rows = await db
    .select({
      id: accessRequests.id,
      unionId: accessRequests.unionId,
      player: accessRequests.playerName,
      claimed: accessRequests.claimedRole,
      rank: accessRequests.rosterRank,
      seenAt: accessRequests.rosterSeenAt,
      createdAt: accessRequests.createdAt,
      decision: accessRequests.decision,
      decidedAt: accessRequests.decidedAt,
    })
    .from(accessRequests)
    .orderBy(desc(accessRequests.createdAt));
  return rows;
}
