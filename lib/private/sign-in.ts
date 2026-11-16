// The Discord sign-in round trip (D71, D73). Login: a random `state` (it carries the slug) in a 10-minute
// __Host- cookie, then Discord's authorize page. Callback, one fixed path for every workspace: the state
// compared in constant time (a mismatch counts in auth_attempts), the code exchanged, the member's roles
// read, and a session made when a role is a leadership role or the account is on the allowlist.
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
  type WorkspaceRow,
  type WorkspaceUserRow,
} from "../repo/workspaces";
import { authorizeUrl, discordConfig, readMember, type DiscordMember } from "./discord";
import { privateLog } from "./log";
import { cookieAttributes, createSession } from "./session";

export const STATE_COOKIE = "__Host-lap_ws_state";
export const STATE_MS = 10 * 60_000;
export const CALLBACK_PATH = "/api/w/auth/callback";
export const SLUG = WORKSPACE_SLUG;

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

export async function startSignIn(
  db: Db,
  deps: SignInDeps,
  slug: string,
  origin: string,
  silent: boolean,
): Promise<Step> {
  const config = discordConfig(deps.env);
  if (!config) return go(`/w/${slug}?e=not_configured`);
  if (!(await findWorkspaceBySlug(db, slug))) return go(`/w/${slug}`);
  const state = `${slug}.${randomBytes(32).toString("base64url")}`;
  const location = authorizeUrl(config, `${origin}${CALLBACK_PATH}`, state, silent);
  return go(location, [`${STATE_COOKIE}=${state}; ${cookieAttributes(STATE_MS)}`]);
}

export interface CallbackInput {
  query: URLSearchParams;
  stateCookie: string | undefined;
  ip: string;
  origin: string;
}

/** The slug the state carries, once cookie and query agree; null otherwise. */
function checkedSlug(cookie: string | undefined, given: string | null): string | null {
  if (!cookie || !given || !secretEquals(given, cookie)) return null;
  const slug = given.split(".")[0] ?? "";
  return SLUG.test(slug) ? slug : null;
}

export async function finishSignIn(db: Db, deps: SignInDeps, input: CallbackInput): Promise<Step> {
  const ipKey = `w:ip:${input.ip}`;
  // INVARIANT workspace.state-rate-limit: bad states share the PIN limits (5 per IP per 15 min).
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, deps.now)) >= IP_LIMIT) {
    return { kind: "refused", status: 429, code: "rate_limited" };
  }
  const slug = checkedSlug(input.stateCookie, input.query.get("state"));
  if (!slug) {
    const count = await recordFailure(db, ipKey, IP_WINDOW_MS, deps.now);
    privateLog("w.state_bad", { count });
    return { kind: "refused", status: 400, code: "bad_state" };
  }
  const config = discordConfig(deps.env);
  if (!config) return go(`/w/${slug}?e=not_configured`);
  const code = input.query.get("code");
  if (input.query.has("error") || !code) return go(`/w/${slug}?e=denied`);
  const workspace = await findWorkspaceBySlug(db, slug);
  if (!workspace) return go(`/w/${slug}`);

  const member = await readMember(
    deps.fetch,
    config,
    code,
    `${input.origin}${CALLBACK_PATH}`,
    workspace.discordGuildId,
  );
  if (!member.ok) {
    privateLog(`w.${member.code}`, { workspace: workspace.id });
    return go(`/w/${slug}?e=discord`);
  }
  return admit(db, workspace, member, deps.now, analyticsKey(deps.env) !== undefined);
}

/** Why an account gets no access, in the words the no-access page explains. */
export type NoAccess = "not_member" | "no_role" | "allowlist_expired" | "blocked";

/** null: let in, through a leadership role or an allowlist entry that has not expired. */
function refusalOf(
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

async function admit(
  db: Db,
  workspace: WorkspaceRow,
  member: Extract<DiscordMember, { ok: true }>,
  now: Date,
  analytics: boolean,
): Promise<Step> {
  const known = await findWorkspaceUser(db, workspace.id, member.userId);
  const viaRole = member.roles?.some((r) => workspace.leaderRoleIds.includes(r)) ?? false;
  const refusal = refusalOf(known, viaRole, member.roles === null, now);
  if (refusal) {
    privateLog("w.no_access", { workspace: workspace.id });
    return go(`/w/${workspace.slug}/no-access?why=${refusal}`);
  }
  // Only people who get in are stored: a refused account leaves no row.
  const userId = await recordSignIn(db, workspace.id, member.userId, member.displayName, now);
  // INVARIANT workspace.allowlist-cap: let in only by the allowlist, the session ends with the entry.
  const endsBy = viaRole ? null : (known?.allowlistExpiresAt ?? null);
  const { cookie } = await createSession(db, workspace.id, userId, now, endsBy);
  privateLog("w.sign_in", { workspace: workspace.id, via_role: viaRole ? 1 : 0 });
  // With analytics on, a fragment that never reaches a server: the page counts the sign-in and removes it (D77).
  return go(`/w/${workspace.slug}${analytics ? SIGNED_IN_HASH : ""}`, [clearState, cookie]);
}
