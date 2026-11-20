// A new alliance's way in (D130, issue 453), apart from lib/schema.ts for its size; drizzle.config.ts lists this
// file too. `alliance_invites`: the owner's one-time links, each bound to one alliance, stored only as a hash,
// with who signed in through it, the servers Discord said they manage (dropped when the link is used) and the
// server picked. `access_requests`: "Request a Desk" from the public form, keeping only the alliance, the
// in-game name, the rank claimed and what the newest roster says (D71: no other roster field). Neither table
// belongs to a workspace: the owner's records, deleted 30 days after they are decided, used or expired.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/** A server the invited person may pick: Discord says they own it or can manage it. */
export interface InviteGuild {
  id: string;
  name: string;
}

export const CLAIMED_ROLES = ["r5", "r4"] as const;
export type ClaimedRole = (typeof CLAIMED_ROLES)[number];
export const ROSTER_MATCHES = ["found", "not_found"] as const;
export type RosterMatch = (typeof ROSTER_MATCHES)[number];

export const allianceInvites = pgTable("alliance_invites", {
  id: serial("id").primaryKey(),
  unionId: big("union_id").notNull(),
  /** sha256 of the link's secret; the link itself is shown once, to the owner. */
  tokenHash: text("token_hash").notNull(),
  createdAt: tstz("created_at").notNull(),
  expiresAt: tstz("expires_at").notNull(),
  cancelledAt: tstz("cancelled_at"),
  /** The Discord account that signed in through the link first; only it may go on. */
  claimedBy: text("claimed_by"),
  claimedName: text("claimed_name"),
  /** sha256 of the browser's claim cookie, new at each sign-in through the link. */
  claimHash: text("claim_hash"),
  guilds: jsonb("guilds").$type<InviteGuild[]>(),
  guildId: text("guild_id"),
  usedAt: tstz("used_at"),
  /** The address of the workspace it made, for /admin; not a key, so the workspace's purge is not held. */
  createdSlug: text("created_slug"),
});

export const accessRequests = pgTable(
  "access_requests",
  {
    id: serial("id").primaryKey(),
    unionId: big("union_id").notNull(),
    /** The in-game name as typed. */
    playerName: text("player_name").notNull(),
    claimedRole: text("claimed_role", { enum: CLAIMED_ROLES }).notNull(),
    rosterMatch: text("roster_match", { enum: ROSTER_MATCHES }).notNull(),
    /** The rank the newest roster gives that name ("R4 · Recruiter"); null when not found. */
    rosterRank: text("roster_rank"),
    /** When the upstream read that roster. */
    rosterSeenAt: tstz("roster_seen_at"),
    /** sha256 of the requester's status secret (the cookie and the status link). */
    statusHash: text("status_hash").notNull(),
    createdAt: tstz("created_at").notNull(),
    decision: text("decision", { enum: ["approved", "declined"] }),
    decidedAt: tstz("decided_at"),
    declineReason: text("decline_reason"),
    inviteId: integer("invite_id").references(() => allianceInvites.id, { onDelete: "set null" }),
  },
  (t) => [
    check("access_requests_role_check", sql`${t.claimedRole} in ('r5', 'r4')`),
    check("access_requests_match_check", sql`${t.rosterMatch} in ('found', 'not_found')`),
  ],
);
