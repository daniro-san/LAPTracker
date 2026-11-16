// Workspace sessions (D71, D73): a random 32-byte token in a __Host- cookie, only its sha256 in
// workspace_sessions. A session lasts at most 24 hours and belongs to one workspace.
import { createHash, randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceSessions } from "../schema";

export const SESSION_COOKIE = "__Host-lap_ws";
export const SESSION_MS = 24 * 60 * 60_000;

/** HttpOnly, Secure, SameSite=Lax: the OAuth callback arrives from discord.com, a cross-site navigation. */
export const cookieAttributes = (maxAgeMs: number) =>
  `Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; Secure; SameSite=Lax`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(
  db: Db,
  workspaceId: number,
  workspaceUserId: number,
  now: Date,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(workspaceSessions).values({
    tokenHash: hashToken(token),
    workspaceId,
    workspaceUserId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_MS),
  });
  return token;
}

export const sessionCookie = (token: string) =>
  `${SESSION_COOKIE}=${token}; ${cookieAttributes(SESSION_MS)}`;
export const clearSessionCookie = () => `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;

/** Ends one session, only inside its own workspace. */
export async function revokeSession(db: Db, workspaceId: number, token: string): Promise<void> {
  await db
    .delete(workspaceSessions)
    .where(
      and(
        eq(workspaceSessions.tokenHash, hashToken(token)),
        eq(workspaceSessions.workspaceId, workspaceId),
      ),
    );
}
