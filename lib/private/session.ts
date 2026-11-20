// Workspace sessions (D71, D73, D99): a random 32-byte token in a __Host- cookie, only its sha256 in
// workspace_sessions; a session belongs to one workspace. No Discord token is kept (D71), so the role is
// confirmed only by a trip through Discord: at sign-in, and at each renewal. A session is served for 24 hours
// after that check; a page renews it through Discord once the check is 23 hours old, so the trip comes about
// once a day, as under D73, and an API call made from a page loaded before then still has an hour left. It
// ends seven days after sign-in at the latest, and never past the allowlist entry that let its person in.
// A member's session (D105) opens only the members' board: it lasts 30 days, and the board confirms the
// member role through Discord, like an officer's, once its check is 24 hours old (amended 2026-11-17).
import { createHash, randomBytes } from "node:crypto";

import type { Db } from "../db";
import { deleteSession, insertSession, renewSession, type SessionTier } from "../repo/workspaces";

/** The cookie of sessions made before D131: one per browser. Still read, never written. */
export const SESSION_COOKIE = "__Host-lap_ws";

/** One session cookie per workspace (D131), so signing in to a second workspace keeps the first. */
export const sessionCookieName = (slug: string) => `${SESSION_COOKIE}.${slug}`;

/**
 * The name of the cookie that carries `slug`'s session, given which cookies the browser holds (`has`): the
 * workspace's own, else the one cookie of before D131, which counts only while the workspace has no cookie
 * of its own. null: neither.
 */
export function sessionCookieFor(has: (name: string) => boolean, slug: string): string | null {
  const own = sessionCookieName(slug);
  if (has(own)) return own;
  return has(SESSION_COOKIE) ? SESSION_COOKIE : null;
}

/** This browser's session cookie for `slug` and its token (`sessionCookieFor`), or null. */
export function sessionToken(
  cookies: { get(name: string): { value: string } | undefined },
  slug: string,
): { name: string; value: string } | null {
  const name = sessionCookieFor((n) => Boolean(cookies.get(n)?.value), slug);
  const value = name ? cookies.get(name)?.value : undefined;
  return name && value ? { name, value } : null;
}
/** The cap: a session ends this long after sign-in, however often it was renewed. */
export const SESSION_MS = 7 * 24 * 60 * 60_000;
/** A member's session (D105) ends this long after sign-in; its role is checked again every CHECK_MS. */
export const MEMBER_SESSION_MS = 30 * 24 * 60 * 60_000;
/** A role check is good this long: past it, a workspace API answers signed_out (D99). */
export const CHECK_MS = 24 * 60 * 60_000;
/** A page renews the check through Discord once it is this old (the last hour of the day). */
export const RENEW_MS = 23 * 60 * 60_000;
/** An officer's request marks the session seen at most this often (D108). */
export const SEEN_EVERY_MS = 60_000;

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
 * A new session: seven days for an officer, 30 for a member (D105). `endsBy` caps it (an allowlist
 * expiry). `sessionCookie` makes the cookie that carries it.
 */
export async function createSession(
  db: Db,
  workspaceId: number,
  workspaceUserId: number,
  now: Date,
  endsBy: Date | null,
  tier: SessionTier,
): Promise<{ token: string; expiresAt: Date }> {
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
  return { token, expiresAt };
}

/** The cookie of a session of `slug`, kept by the browser until the session's end. */
export const sessionCookie = (slug: string, token: string, expiresAt: Date, now: Date) =>
  `${sessionCookieName(slug)}=${token}; ${cookieAttributes(expiresAt.getTime() - now.getTime())}`;

/**
 * After Discord confirmed the role: the browser's own session (`token`) of this workspace, person and tier
 * is renewed in place, keeping its cookie and its end. Otherwise a new session is made, and the browser's
 * old one in this workspace ends (a member who became an officer, or the other way round, D105).
 * Returns the cookie to set, or null when the browser's cookie stays as it is.
 */
export async function renewOrCreate(
  db: Db,
  token: string | undefined,
  ids: { slug: string; workspaceId: number; workspaceUserId: number; tier: SessionTier },
  now: Date,
  endsBy: Date | null,
): Promise<string | null> {
  const { slug, workspaceId, workspaceUserId, tier } = ids;
  const key = token ? { tokenHash: hashToken(token), workspaceId, workspaceUserId, tier } : null;
  if (key && (await renewSession(db, key, now, endsBy))) return null;
  if (key) await deleteSession(db, workspaceId, key.tokenHash);
  const made = await createSession(db, workspaceId, workspaceUserId, now, endsBy, tier);
  return sessionCookie(slug, made.token, made.expiresAt, now);
}

export const clearSessionCookie = (name: string) => `${name}=; ${cookieAttributes(0)}`;

/** Ends one session, only inside its own workspace. */
export async function revokeSession(db: Db, workspaceId: number, token: string): Promise<void> {
  await deleteSession(db, workspaceId, hashToken(token));
}
