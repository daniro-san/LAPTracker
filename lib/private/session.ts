// Workspace sessions (D71, D73, D99): a random 32-byte token in a __Host- cookie, only its sha256 in
// workspace_sessions; a session belongs to one workspace. No Discord token is kept (D71), so the role is
// confirmed only by a trip through Discord: at sign-in, and at each renewal. A session is served for 24 hours
// after that check; a page renews it through Discord once the check is 23 hours old, so the trip comes about
// once a day, as under D73, and an API call made from a page loaded before then still has an hour left. It
// ends seven days after sign-in at the latest, and never past the allowlist entry that let its person in.
// A member's session (D105) opens only the members' board: it lasts 30 days with no role check in between,
// because each trip through Discord on a phone can ask the member to sign in again.
import { createHash, randomBytes } from "node:crypto";

import type { Db } from "../db";
import { deleteSession, insertSession, renewSession, type SessionTier } from "../repo/workspaces";

export const SESSION_COOKIE = "__Host-lap_ws";
/** The cap: a session ends this long after sign-in, however often it was renewed. */
export const SESSION_MS = 7 * 24 * 60 * 60_000;
/** A member's session (D105) ends this long after sign-in; Discord is not asked again before then. */
export const MEMBER_SESSION_MS = 30 * 24 * 60 * 60_000;
/** A role check is good this long: past it, a workspace API answers signed_out (D99). */
export const CHECK_MS = 24 * 60 * 60_000;
/** A page renews the check through Discord once it is this old (the last hour of the day). */
export const RENEW_MS = 23 * 60 * 60_000;

/** HttpOnly, Secure, SameSite=Lax: the OAuth callback arrives from discord.com, a cross-site navigation. */
export const cookieAttributes = (maxAgeMs: number) =>
  `Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; Secure; SameSite=Lax`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The session's state at `now`: ended (past its end), stale (served no more until Discord confirms the
 * role again, after `checkWithin`), or fine. Pages pass RENEW_MS, the API routes CHECK_MS.
 */
export function sessionState(
  s: { expiresAt: Date; checkedAt: Date },
  now: Date,
  checkWithin: number,
): "ended" | "stale" | "fine" {
  if (s.expiresAt.getTime() <= now.getTime()) return "ended";
  return now.getTime() - s.checkedAt.getTime() >= checkWithin ? "stale" : "fine";
}

/**
 * A new session and the cookie that carries it: seven days for an officer, 30 for a member (D105).
 * `endsBy` caps it (an allowlist expiry).
 */
export async function createSession(
  db: Db,
  workspaceId: number,
  workspaceUserId: number,
  now: Date,
  endsBy: Date | null,
  tier: SessionTier = "officer",
): Promise<{ token: string; cookie: string }> {
  const token = randomBytes(32).toString("base64url");
  const full = now.getTime() + (tier === "member" ? MEMBER_SESSION_MS : SESSION_MS);
  const expiresAt = new Date(endsBy ? Math.min(full, endsBy.getTime()) : full);
  await insertSession(
    db,
    {
      tokenHash: hashToken(token),
      workspaceId,
      workspaceUserId,
      createdAt: now,
      expiresAt,
      checkedAt: now,
      tier,
    },
    now,
  );
  const cookie = `${SESSION_COOKIE}=${token}; ${cookieAttributes(expiresAt.getTime() - now.getTime())}`;
  return { token, cookie };
}

/**
 * After Discord confirmed the role: the browser's own session (`token`) of this workspace, person and tier
 * is renewed in place, keeping its cookie and its end. Otherwise a new session is made, and the browser's
 * old one in this workspace ends (a member who became an officer, or the other way round, D105).
 * Returns the cookie to set, or null when the browser's cookie stays as it is.
 */
export async function renewOrCreate(
  db: Db,
  token: string | undefined,
  ids: { workspaceId: number; workspaceUserId: number; tier: SessionTier },
  now: Date,
  endsBy: Date | null,
): Promise<string | null> {
  const key = token ? { tokenHash: hashToken(token), ...ids } : null;
  if (key && (await renewSession(db, key, now, endsBy))) return null;
  if (key) await deleteSession(db, ids.workspaceId, key.tokenHash);
  const { workspaceId, workspaceUserId, tier } = ids;
  return (await createSession(db, workspaceId, workspaceUserId, now, endsBy, tier)).cookie;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;

/** Ends one session, only inside its own workspace. */
export async function revokeSession(db: Db, workspaceId: number, token: string): Promise<void> {
  await deleteSession(db, workspaceId, hashToken(token));
}
