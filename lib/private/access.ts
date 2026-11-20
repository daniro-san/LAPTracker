// The workspace's doors (D71, D96, D105): `requireWorkspace` (a checked officer session) and `officerAccess`
// (the Discord command, after its signature and officer checks) are the only makers of a WorkspaceAccess,
// through `grant`. Every private query takes one, so the workspace id never comes from a request. A member's
// session never gets one: `requireBoard` gives it a BoardAccess, which opens only the members' board.
import type { Db } from "../db";
import {
  deleteSession,
  findSession,
  findWorkspaceBySlug,
  touchSession,
  type WorkspaceRow,
} from "../repo/workspaces";
import type { WorkspaceFeatures } from "../workspace-features";
import { featuresBySlug } from "./features";
import {
  CHECK_MS,
  hashToken,
  RENEW_MS,
  SEEN_EVERY_MS,
  revokeSession,
  SESSION_COOKIE,
  sessionState,
} from "./session";

declare const accessBrand: unique symbol;

export type WorkspaceAccess = {
  readonly ok: true;
  readonly workspaceId: number;
  readonly unionId: number;
  readonly slug: string;
  /** "Delete this workspace" (D125): when the daily job deletes it, or null when no deletion is asked. */
  readonly purgeAfter: Date | null;
  /** displayName: the name the officer chose, else the one from Discord. playerUid: "This is me" (issue 334). */
  readonly user: {
    readonly id: number;
    readonly displayName: string | null;
    readonly playerUid: number | null;
  };
  /** The features the owner has on for this workspace, and its daily caps (D126). */
  readonly features: WorkspaceFeatures;
  readonly [accessBrand]: true;
};

/**
 * no_workspace: no workspace has this slug. signed_out: no cookie, or no session for it.
 * other_workspace: the session belongs to another workspace. expired: past its end (seven days, or the
 * allowlist expiry), or its Discord role check is too old (D99), so a silent Discord re-authorisation
 * follows. blocked: the account is blocked in this workspace. member: a member's session, which opens
 * only the members' board (D105).
 */
export type Refusal = {
  readonly ok: false;
  readonly reason:
    "no_workspace" | "signed_out" | "other_workspace" | "expired" | "blocked" | "member";
};

declare const boardBrand: unique symbol;

/**
 * The members' board's door (D105): a member's session, or an officer's looking at what members see. It
 * carries no WorkspaceAccess, so no officer read takes it.
 */
export type BoardAccess = {
  readonly ok: true;
  readonly workspaceId: number;
  readonly unionId: number;
  readonly slug: string;
  /** The workspace's Discord server, for the link to it. */
  readonly guildId: string;
  /** "Delete this workspace" (D125): when the daily job deletes it, or null when no deletion is asked. */
  readonly purgeAfter: Date | null;
  /** True for an officer's session: the board shows the officer's way back to the desk. */
  readonly officer: boolean;
  readonly name: string | null;
  /** The workspace user, only for the pseudonymous analytics id (D115); no read takes it. */
  readonly userId: number;
  /** D126: the board itself, and its notices, can be turned off. */
  readonly features: WorkspaceFeatures;
  readonly [boardBrand]: true;
};

/** What Next's `cookies()` returns, reduced to the one call made here. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

type Session = NonNullable<Awaited<ReturnType<typeof findSession>>>;
type Refuse = (reason: Refusal["reason"]) => Refusal;
const refuse: Refuse = (reason) => ({ ok: false, reason });

/** The workspace and this browser's session of it, whatever the session's state and tier. */
async function openSession(
  db: Db,
  slug: string,
  cookies: CookieReader,
): Promise<{ workspace: WorkspaceRow; session: Session; features: WorkspaceFeatures } | Refusal> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  // The reads at once; the refusals keep their order (no workspace, then no session).
  const [workspace, session, features] = await Promise.all([
    findWorkspaceBySlug(db, slug),
    token ? findSession(db, hashToken(token)) : null,
    featuresBySlug(db, slug),
  ]);
  if (!workspace || !features) return refuse("no_workspace");
  if (!session) return refuse("signed_out");
  // INVARIANT workspace.session-bound: a session of one workspace opens no other.
  if (session.workspaceId !== workspace.id) return refuse("other_workspace");
  return { workspace, session, features };
}

/** Why a found session is not served at `now` (ended, blocked, its role check too old), or null. */
async function servedOrNot(
  db: Db,
  workspace: WorkspaceRow,
  session: Session,
  now: Date,
  checkWithin: number,
): Promise<Refusal | null> {
  const state = sessionState(session, now, checkWithin);
  if (state === "ended") {
    await deleteSession(db, workspace.id, session.tokenHash);
    return refuse("expired");
  }
  if (session.blocked) return refuse("blocked");
  // INVARIANT workspace.role-recheck: no request is served on a role check older than CHECK_MS. The row
  // stays, so the sign-in that confirms the role again renews this same session.
  return state === "stale" ? refuse("expired") : null;
}

/**
 * `checkWithin`: how old the session's Discord role check may be. The API routes keep the default, 24
 * hours; pages pass RENEW_MS (23 hours), so they renew the check before the API would refuse it (D99).
 */
export async function requireWorkspace(
  db: Db,
  slug: string,
  cookies: CookieReader,
  now: Date,
  checkWithin = CHECK_MS,
): Promise<WorkspaceAccess | Refusal> {
  const found = await openSession(db, slug, cookies);
  if ("ok" in found) return found;
  const { workspace, session, features } = found;
  // INVARIANT workspace.member-board-only: only an officer's session opens an officer page, route or API;
  // a member's, or any other tier, does not (D105).
  if (session.tier !== "officer") return refuse("member");
  const refusal = await servedOrNot(db, workspace, session, now, checkWithin);
  if (refusal) return refusal;
  // "On the desk now" (D108): an officer's request marks the session seen, at most once a minute.
  const since = new Date(now.getTime() - SEEN_EVERY_MS);
  if (!session.seenAt || session.seenAt < since) {
    await touchSession(db, session.tokenHash, now, since);
  }
  return grant(
    workspace,
    {
      id: session.userId,
      displayName: session.chosenName ?? session.displayName,
      playerUid: session.playerUid,
    },
    features,
  );
}

/**
 * The members' board (D105): a member's session is served for 24 hours after its role check (CHECK_MS),
 * then the page sends it through Discord silently, which confirms the member role again or ends the
 * session (amended 2026-11-17). With no member role set, a member's session is not served at all and goes
 * the same way. An officer's keeps its page rule (RENEW_MS, D99), so the officer's trip through Discord
 * comes as on the desk.
 */
export async function requireBoard(
  db: Db,
  slug: string,
  cookies: CookieReader,
  now: Date,
): Promise<BoardAccess | Refusal> {
  const found = await openSession(db, slug, cookies);
  if ("ok" in found) return found;
  const { workspace, session, features } = found;
  const officer = session.tier === "officer";
  // INVARIANT workspace.member-recheck: a member's role is confirmed again at least once a day, and no
  // member's session is served while the workspace has no member role.
  const closed = !officer && workspace.memberRoleIds.length === 0;
  const within = officer ? RENEW_MS : closed ? 0 : CHECK_MS;
  const refusal = await servedOrNot(db, workspace, session, now, within);
  if (refusal) return refusal;
  const fields: Omit<BoardAccess, typeof boardBrand> = {
    ok: true,
    workspaceId: workspace.id,
    unionId: workspace.unionId,
    slug: workspace.slug,
    guildId: workspace.discordGuildId,
    purgeAfter: workspace.purgeAfter,
    officer,
    name: session.chosenName ?? session.displayName,
    userId: session.userId,
    features,
  };
  return fields as BoardAccess;
}

type Granted = Omit<WorkspaceAccess, "ok" | "user" | "features" | typeof accessBrand>;

/** The one place the brand is set: a workspace, the person who passed its door, and its features. */
function grant(
  workspace: { id: number; unionId: number; slug: string; purgeAfter?: Date | null },
  user: WorkspaceAccess["user"],
  features: WorkspaceFeatures,
): WorkspaceAccess {
  const fields: Granted & Pick<WorkspaceAccess, "ok" | "user" | "features"> = {
    ok: true,
    workspaceId: workspace.id,
    unionId: workspace.unionId,
    slug: workspace.slug,
    purgeAfter: workspace.purgeAfter ?? null,
    user,
    features,
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
  features: WorkspaceFeatures,
): WorkspaceAccess {
  return grant(
    workspace,
    {
      id: officer.id,
      displayName: officer.chosenName ?? officer.displayName,
      playerUid: officer.playerUid,
    },
    features,
  );
}

/** Sign out: ends this browser's session, only when it is a valid one of this workspace. */
export async function signOut(
  db: Db,
  slug: string,
  cookies: CookieReader,
  now: Date,
): Promise<boolean> {
  // A session waiting for its role check (D99) can still be ended, and so can a member's (D105).
  const found = await openSession(db, slug, cookies);
  if ("ok" in found) return false;
  const { workspace, session } = found;
  if (await servedOrNot(db, workspace, session, now, Number.POSITIVE_INFINITY)) return false;
  await revokeSession(db, workspace.id, cookies.get(SESSION_COOKIE)?.value ?? "");
  return true;
}
