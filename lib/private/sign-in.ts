// The Discord sign-in round trip (D71, D73, D99). Login: a random `state` (it carries the slug and the page
// to return to) in a 10-minute __Host- cookie, then Discord's authorize page. Callback, one fixed path for
// every workspace: the state compared in constant time (a mismatch counts in auth_attempts), the code
// exchanged, the member's roles read, and the session renewed or made when a role is a leadership role or
// the account is on the allowlist. Someone in the workspace's Discord server who holds one of its member
// roles gets a member's session, which opens only the members' board (D105, amended 2026-11-17); anyone
// else is refused. Any other ending drops the browser's session of that workspace.
import { randomBytes } from "node:crypto";

import { analyticsKey, SIGNED_IN_HASH } from "../analytics/events";
import { IP_LIMIT, IP_WINDOW_MS, secretEquals } from "../auth";
import type { Db } from "../db";
import type { Env } from "../env";
import { currentCount, recordFailure } from "../repo/auth-attempts";
import {
  findWorkspaceBySlug,
  findWorkspaceUser,
  recordSignIn,
  WORKSPACE_SLUG,
  type SessionTier,
  type WorkspaceRow,
  type WorkspaceUserRow,
} from "../repo/workspaces";
import { authorizeUrl, discordConfig, readMember, type DiscordMember } from "./discord";
import { privateLog } from "./log";
import { cookieAttributes, renewOrCreate, revokeSession } from "./session";

export const STATE_COOKIE = "__Host-lap_ws_state";
export const STATE_MS = 10 * 60_000;
export const CALLBACK_PATH = "/api/w/auth/callback";
export const SLUG = WORKSPACE_SLUG;
/** A return path longer than this is dropped (Home is used). */
const MAX_RETURN = 512;
/** Only for parsing: a path that leaves this origin is refused. */
const PROBE = "https://return.invalid";

export interface SignInDeps {
  env: Env;
  fetch: typeof fetch;
  now: Date;
}

/** Where the browser goes next and the cookies set on the way; or a refusal with no redirect. */
export type Step =
  | { kind: "redirect"; location: string; cookies: string[] }
  | { kind: "refused"; status: 400 | 429; code: "bad_state" | "rate_limited" };

const clearState = `${STATE_COOKIE}=; ${cookieAttributes(0)}`;
const go = (location: string, cookies: string[] = [clearState]): Step => ({
  kind: "redirect",
  location,
  cookies,
});

/**
 * The page to return to after sign-in (ADV-7), or null: only a path of this same workspace, `/w/<slug>`
 * or below it, with its query and without its fragment. A scheme, another host (`//x`, `/\x`), a path
 * that `..` takes out of the workspace, or another slug is refused.
 */
export function returnPath(slug: string, raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_RETURN || !raw.startsWith("/") || /[\\\s]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, PROBE);
  } catch {
    return null;
  }
  const home = `/w/${slug}`;
  if (url.origin !== PROBE) return null;
  if (url.pathname !== home && !url.pathname.startsWith(`${home}/`)) return null;
  return `${url.pathname}${url.search}`;
}

export async function startSignIn(
  db: Db,
  deps: SignInDeps,
  slug: string,
  origin: string,
  silent: boolean,
  next?: string | null,
): Promise<Step> {
  const config = discordConfig(deps.env);
  if (!config) return go(`/w/${slug}?e=not_configured`);
  if (!(await findWorkspaceBySlug(db, slug))) return go(`/w/${slug}`);
  const back = returnPath(slug, next);
  const random = randomBytes(32).toString("base64url");
  const state = `${slug}.${random}${back ? `.${Buffer.from(back).toString("base64url")}` : ""}`;
  const location = authorizeUrl(config, `${origin}${CALLBACK_PATH}`, state, silent);
  return go(location, [`${STATE_COOKIE}=${state}; ${cookieAttributes(STATE_MS)}`]);
}

export interface CallbackInput {
  query: URLSearchParams;
  stateCookie: string | undefined;
  /** The browser's workspace session cookie, if any: renewed in place when the role still holds. */
  sessionCookie: string | undefined;
  ip: string;
  origin: string;
}

/** The slug and the return path the state carries, once cookie and query agree; null otherwise. */
function checkedState(
  cookie: string | undefined,
  given: string | null,
): { slug: string; back: string | null } | null {
  if (!cookie || !given || !secretEquals(given, cookie)) return null;
  const [slug = "", , packed] = given.split(".");
  if (!SLUG.test(slug)) return null;
  const back = packed ? returnPath(slug, Buffer.from(packed, "base64url").toString()) : null;
  return { slug, back };
}

export async function finishSignIn(db: Db, deps: SignInDeps, input: CallbackInput): Promise<Step> {
  const ipKey = `w:ip:${input.ip}`;
  // INVARIANT workspace.state-rate-limit: bad states share the PIN limits (5 per IP per 15 min).
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, deps.now)) >= IP_LIMIT) {
    return { kind: "refused", status: 429, code: "rate_limited" };
  }
  const state = checkedState(input.stateCookie, input.query.get("state"));
  if (!state) {
    const count = await recordFailure(db, ipKey, IP_WINDOW_MS, deps.now);
    privateLog("w.state_bad", { count });
    return { kind: "refused", status: 400, code: "bad_state" };
  }
  const { slug } = state;
  const config = discordConfig(deps.env);
  if (!config) return go(`/w/${slug}?e=not_configured`);
  const workspace = await findWorkspaceBySlug(db, slug);
  if (!workspace) return go(`/w/${slug}`);
  // INVARIANT workspace.renewal-or-out: a trip through Discord that does not end in admit() ends the
  // browser's session here, so a page whose session waits for its check shows the sign-in, not a loop.
  const out = async (location: string) => {
    if (input.sessionCookie) await revokeSession(db, workspace.id, input.sessionCookie);
    return go(location);
  };
  const code = input.query.get("code");
  if (input.query.has("error") || !code) return out(`/w/${slug}?e=denied`);

  const member = await readMember(
    deps.fetch,
    config,
    code,
    `${input.origin}${CALLBACK_PATH}`,
    workspace.discordGuildId,
  );
  if (!member.ok) {
    privateLog(`w.${member.code}`, { workspace: workspace.id });
    return out(`/w/${slug}?e=discord`);
  }
  const refusal = await refusalFor(db, workspace, member, deps.now);
  if (refusal.why) {
    privateLog("w.no_access", { workspace: workspace.id });
    return out(`/w/${workspace.slug}/no-access?why=${refusal.why}`);
  }
  return admit(db, workspace, member, refusal, {
    now: deps.now,
    analytics: analyticsKey(deps.env) !== undefined,
    token: input.sessionCookie,
    back: state.back,
  });
}

/**
 * Why an account gets no access, in the words the no-access page explains. no_role: in the server with
 * neither a leadership role nor a member role. board_closed: the same, while the workspace has no member
 * role set, so nobody gets the members' board (D105, amended 2026-11-17).
 */
export type NoAccess = "not_member" | "no_role" | "board_closed" | "allowlist_expired" | "blocked";

/** null: let in, through a leadership role or an allowlist entry that has not expired. */
export function refusalOf(
  known: WorkspaceUserRow | null,
  viaRole: boolean,
  notMember: boolean,
  now: Date,
): NoAccess | null {
  if (known?.blocked) return "blocked";
  if (viaRole) return null;
  if (known?.allowlisted) {
    const expires = known.allowlistExpiresAt;
    return expires === null || expires.getTime() > now.getTime() ? null : "allowlist_expired";
  }
  return notMember ? "not_member" : "no_role";
}

type Admission = { why: null; endsBy: Date | null; viaRole: boolean; tier: SessionTier };

/** Whether the member's roles (null: not in the server) include one of `ids`. */
const holdsAny = (roles: string[] | null, ids: string[]) =>
  roles?.some((r) => ids.includes(r)) ?? false;

/** The refusal, or the session's tier and the end the allowlist puts on it (null otherwise). */
async function refusalFor(
  db: Db,
  workspace: WorkspaceRow,
  member: Extract<DiscordMember, { ok: true }>,
  now: Date,
): Promise<{ why: NoAccess } | Admission> {
  const known = await findWorkspaceUser(db, workspace.id, member.userId);
  const viaRole = holdsAny(member.roles, workspace.leaderRoleIds);
  const why = refusalOf(known, viaRole, member.roles === null, now);
  // INVARIANT workspace.member-tier: in the server, not blocked, not an officer (no leadership role, no
  // allowlist entry that still runs), and holding one of the workspace's member roles: the members' board
  // only (D105, amended 2026-11-17). With no member role set, nobody gets it.
  if (why && why !== "blocked" && holdsAny(member.roles, workspace.memberRoleIds)) {
    return { why: null, endsBy: null, viaRole: false, tier: "member" };
  }
  if (why === "no_role" && workspace.memberRoleIds.length === 0) return { why: "board_closed" };
  if (why) return { why };
  // INVARIANT workspace.allowlist-cap: let in only by the allowlist, the session ends with the entry.
  const endsBy = viaRole ? null : (known?.allowlistExpiresAt ?? null);
  return { why: null, endsBy, viaRole, tier: "officer" };
}

async function admit(
  db: Db,
  workspace: WorkspaceRow,
  member: Extract<DiscordMember, { ok: true }>,
  { endsBy, viaRole, tier }: Admission,
  o: { now: Date; analytics: boolean; token: string | undefined; back: string | null },
): Promise<Step> {
  // Only people who get in are stored: a refused account leaves no row.
  const userId = await recordSignIn(db, workspace.id, member.userId, member.displayName, o.now);
  const ids = { workspaceId: workspace.id, workspaceUserId: userId, tier };
  const cookie = await renewOrCreate(db, o.token, ids, o.now, endsBy);
  privateLog(cookie ? "w.sign_in" : "w.renewed", {
    workspace: workspace.id,
    via_role: viaRole ? 1 : 0,
    member: tier === "member" ? 1 : 0,
  });
  // With analytics on, a fragment that never reaches a server: the page counts the sign-in and removes it
  // (D77). A renewal is not a sign-in. A member always lands on the board (D105).
  const hash = cookie && o.analytics ? SIGNED_IN_HASH : "";
  const home =
    tier === "member" ? `/w/${workspace.slug}/board` : (o.back ?? `/w/${workspace.slug}`);
  const to = `${home}${hash}`;
  return go(to, cookie ? [clearState, cookie] : [clearState]);
}
