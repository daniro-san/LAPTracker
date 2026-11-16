// The workspace's door (D71): `requireWorkspace` is the only maker of a WorkspaceAccess, and every private
// query takes one, so the workspace id always comes from a checked session, never from a request.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { findWorkspaceBySlug } from "../repo/workspaces";
import { workspaceSessions, workspaceUsers } from "../schema";
import { hashToken, revokeSession, SESSION_COOKIE } from "./session";

declare const accessBrand: unique symbol;

export type WorkspaceAccess = {
  readonly ok: true;
  readonly workspaceId: number;
  readonly unionId: number;
  readonly slug: string;
  readonly user: { readonly id: number; readonly displayName: string | null };
  readonly [accessBrand]: true;
};

/**
 * no_workspace: no workspace has this slug. signed_out: no cookie, or no session for it.
 * other_workspace: the session belongs to another workspace. expired: older than 24 hours, so a silent
 * Discord re-authorisation follows. blocked: the account is blocked in this workspace.
 */
export type Refusal = {
  readonly ok: false;
  readonly reason: "no_workspace" | "signed_out" | "other_workspace" | "expired" | "blocked";
};

/** What Next's `cookies()` returns, reduced to the one call made here. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export async function requireWorkspace(
  db: Db,
  slug: string,
  cookies: CookieReader,
  now: Date,
): Promise<WorkspaceAccess | Refusal> {
  const refuse = (reason: Refusal["reason"]): Refusal => ({ ok: false, reason });
  const workspace = await findWorkspaceBySlug(db, slug);
  if (!workspace) return refuse("no_workspace");
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return refuse("signed_out");
  const [session] = await db
    .select({
      tokenHash: workspaceSessions.tokenHash,
      workspaceId: workspaceSessions.workspaceId,
      expiresAt: workspaceSessions.expiresAt,
      userId: workspaceUsers.id,
      displayName: workspaceUsers.displayName,
      blocked: workspaceUsers.blocked,
    })
    .from(workspaceSessions)
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, workspaceSessions.workspaceUserId))
    .where(eq(workspaceSessions.tokenHash, hashToken(token)));
  if (!session) return refuse("signed_out");
  // INVARIANT workspace.session-bound: a session of one workspace opens no other.
  if (session.workspaceId !== workspace.id) return refuse("other_workspace");
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.delete(workspaceSessions).where(eq(workspaceSessions.tokenHash, session.tokenHash));
    return refuse("expired");
  }
  if (session.blocked) return refuse("blocked");
  return {
    ok: true,
    workspaceId: workspace.id,
    unionId: workspace.unionId,
    slug: workspace.slug,
    user: { id: session.userId, displayName: session.displayName },
  } as WorkspaceAccess;
}

/** Sign out: ends this browser's session, only when it is a valid one of this workspace. */
export async function signOut(
  db: Db,
  slug: string,
  cookies: CookieReader,
  now: Date,
): Promise<boolean> {
  const access = await requireWorkspace(db, slug, cookies, now);
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!access.ok || !token) return false;
  await revokeSession(db, access.workspaceId, token);
  return true;
}
