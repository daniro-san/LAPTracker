// Workspace sessions (D71, D73, D99): a random 32-byte token in a __Host- cookie, only its sha256 in
// workspace_sessions; a session belongs to one workspace. No Discord token is kept (D71), so the role is
// confirmed only by a trip through Discord: at sign-in, and at each renewal. A session is served for an hour
// after that check; a page renews it through Discord once the check is half an hour old, so an officer who
// keeps using the desk is not stopped. It ends seven days after sign-in at the latest, and never past the
// allowlist entry that let its person in.
import { createHash, randomBytes } from "node:crypto";

import type { Db } from "../db";
import { deleteSession, insertSession, renewSession } from "../repo/workspaces";

export const SESSION_COOKIE = "__Host-lap_ws";
/** The cap: a session ends this long after sign-in, however often it was renewed. */
export const SESSION_MS = 7 * 24 * 60 * 60_000;
/** A role check is good this long: past it, a workspace API answers signed_out (D99). */
export const CHECK_MS = 60 * 60_000;
/** A page renews the check through Discord once it is this old (the last part of the hour). */
export const RENEW_MS = 30 * 60_000;

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

/** A new session and the cookie that carries it. `endsBy` caps the seven days (an allowlist expiry). */
export async function createSession(
  db: Db,
  workspaceId: number,
  workspaceUserId: number,
  now: Date,
  endsBy: Date | null,
): Promise<{ token: string; cookie: string }> {
  const token = randomBytes(32).toString("base64url");
  const full = now.getTime() + SESSION_MS;
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
    },
    now,
  );
  const cookie = `${SESSION_COOKIE}=${token}; ${cookieAttributes(expiresAt.getTime() - now.getTime())}`;
  return { token, cookie };
}

/**
 * After Discord confirmed the role: the browser's own session (`token`) of this workspace and person is
 * renewed in place, keeping its cookie and its seven-day end. Without one, a new session is made.
 * Returns the cookie to set, or null when the browser's cookie stays as it is.
 */
export async function renewOrCreate(
  db: Db,
  token: string | undefined,
  ids: { workspaceId: number; workspaceUserId: number },
  now: Date,
  endsBy: Date | null,
): Promise<string | null> {
  const key = token ? { tokenHash: hashToken(token), ...ids } : null;
  if (key && (await renewSession(db, key, now, endsBy))) return null;
  return (await createSession(db, ids.workspaceId, ids.workspaceUserId, now, endsBy)).cookie;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;

/** Ends one session, only inside its own workspace. */
export async function revokeSession(db: Db, workspaceId: number, token: string): Promise<void> {
  await deleteSession(db, workspaceId, hashToken(token));
}
