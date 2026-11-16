// The workspace's door (D71): `requireWorkspace` is the only maker of a WorkspaceAccess, and every private
// query takes one, so the workspace id always comes from a checked session, never from a request.
import type { Db } from "../db";
import { deleteSession, findSession, findWorkspaceBySlug } from "../repo/workspaces";
import { hashToken, revokeSession, SESSION_COOKIE } from "./session";

declare const accessBrand: unique symbol;

export type WorkspaceAccess = {
  readonly ok: true;
  readonly workspaceId: number;
  readonly unionId: number;
  readonly slug: string;
  /** displayName: the name the officer chose, else the one from Discord. playerUid: "This is me" (issue 334). */
  readonly user: {
    readonly id: number;
    readonly displayName: string | null;
    readonly playerUid: number | null;
  };
  readonly [accessBrand]: true;
};

/**
 * no_workspace: no workspace has this slug. signed_out: no cookie, or no session for it.
 * other_workspace: the session belongs to another workspace. expired: past its end (24 hours, or the
 * allowlist expiry), so a silent Discord re-authorisation follows. blocked: the account is blocked in this workspace.
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
  const token = cookies.get(SESSION_COOKIE)?.value;
  // Both reads at once; the refusals keep their order (no workspace, then no session).
  const [workspace, session] = await Promise.all([
    findWorkspaceBySlug(db, slug),
    token ? findSession(db, hashToken(token)) : null,
  ]);
  if (!workspace) return refuse("no_workspace");
  if (!session) return refuse("signed_out");
  // INVARIANT workspace.session-bound: a session of one workspace opens no other.
  if (session.workspaceId !== workspace.id) return refuse("other_workspace");
  if (session.expiresAt.getTime() <= now.getTime()) {
    await deleteSession(db, workspace.id, session.tokenHash);
    return refuse("expired");
  }
  if (session.blocked) return refuse("blocked");
  return {
    ok: true,
    workspaceId: workspace.id,
    unionId: workspace.unionId,
    slug: workspace.slug,
    user: {
      id: session.userId,
      displayName: session.chosenName ?? session.displayName,
      playerUid: session.playerUid,
    },
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
