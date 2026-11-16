// Workspace sessions (D71, D73): a random 32-byte token in a __Host- cookie, only its sha256 in
// workspace_sessions. A session lasts at most 24 hours, and never past the allowlist entry that let its
// person in; it belongs to one workspace.
import { createHash, randomBytes } from "node:crypto";

import type { Db } from "../db";
import { deleteSession, insertSession } from "../repo/workspaces";

export const SESSION_COOKIE = "__Host-lap_ws";
export const SESSION_MS = 24 * 60 * 60_000;

/** HttpOnly, Secure, SameSite=Lax: the OAuth callback arrives from discord.com, a cross-site navigation. */
export const cookieAttributes = (maxAgeMs: number) =>
  `Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; Secure; SameSite=Lax`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new session and the cookie that carries it. `endsBy` caps the 24 hours (an allowlist expiry). */
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
    { tokenHash: hashToken(token), workspaceId, workspaceUserId, createdAt: now, expiresAt },
    now,
  );
  const cookie = `${SESSION_COOKIE}=${token}; ${cookieAttributes(expiresAt.getTime() - now.getTime())}`;
  return { token, cookie };
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;

/** Ends one session, only inside its own workspace. */
export async function revokeSession(db: Db, workspaceId: number, token: string): Promise<void> {
  await deleteSession(db, workspaceId, hashToken(token));
}
