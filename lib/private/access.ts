// The workspace's doors (D71, D96): `requireWorkspace` (a checked session) and `officerAccess` (the Discord
// command, after its signature and officer checks) are the only makers of a WorkspaceAccess, through
// `grant`. Every private query takes one, so the workspace id never comes from a request.
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
  return grant(workspace, {
    id: session.userId,
    displayName: session.chosenName ?? session.displayName,
    playerUid: session.playerUid,
  });
}

type Granted = Omit<WorkspaceAccess, "ok" | "user" | typeof accessBrand>;

/** The one place the brand is set: a workspace and the person who passed its door. */
function grant(
  workspace: { id: number; unionId: number; slug: string },
  user: WorkspaceAccess["user"],
): WorkspaceAccess {
  const fields: Granted & Pick<WorkspaceAccess, "ok" | "user"> = {
    ok: true,
    workspaceId: workspace.id,
    unionId: workspace.unionId,
    slug: workspace.slug,
    user,
  };
  return fields as WorkspaceAccess;
}

/**
 * The Discord command's door (D96): the workspace of the interaction's server and an officer who passed
 * its rule (leadership role or allowlist, D71) on a signature-checked interaction. The name is the one the
 * officer chose in the desk, else Discord's; "This is me" is their linked player (issue 334).
 */
export function officerAccess(
  workspace: { id: number; unionId: number; slug: string },
  officer: {
    id: number;
    displayName: string | null;
    chosenName: string | null;
    playerUid: number | null;
  },
): WorkspaceAccess {
  return grant(workspace, {
    id: officer.id,
    displayName: officer.chosenName ?? officer.displayName,
    playerUid: officer.playerUid,
  });
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
