// "Sign in" from the public site (D131, issue 457): one Discord sign-in at /w finds every workspace this
// account may open. Discord's server list is read once, on the server, matched against the workspaces'
// servers and dropped: it is never stored or logged. Each match is checked exactly as a workspace's own
// sign-in checks it (D71, D105: a leadership role or the allowlist gives the desk, a member role the board),
// and each one that passes gets its own session cookie (D131), so the person holds all of them at once.
// The /w list is read from this browser's own session cookies only, so it never names another workspace.
import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { Db } from "../db";
import {
  sessionsByHashes,
  workspacesOnServers,
  type SessionTier,
  type WorkspaceRow,
} from "../repo/workspaces";
import { authorizeUrl, discordConfig, exchangeCode, memberIn, SCOPES, userSchema } from "./discord";
import { allianceOf } from "./invite";
import { stateRefusal } from "./invite-sign-in";
import { privateLog } from "./log";
import {
  cookieAttributes,
  hashToken,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieFor,
  sessionToken,
} from "./session";
import {
  admit,
  CALLBACK_PATH,
  landing,
  refusalFor,
  STATE_COOKIE,
  STATE_MS,
  type CallbackInput,
  type SignInDeps,
  type Step,
  type StepMarks,
} from "./sign-in";

/** The workspace sign-in's scopes plus `guilds`, the list of the account's servers. */
export const CHOOSER_SCOPES = `${SCOPES} guilds`;
/** A slug has two characters at least, so no workspace's state starts with this. */
export const CHOOSER_STATE_PREFIX = "w.";
const PAGE = "/w";
/** At most this many matching servers are checked: one Discord read each. */
export const MAX_SERVERS = 10;

const clearState = `${STATE_COOKIE}=; ${cookieAttributes(0)}`;
const go = (location: string, cookies: string[] = [clearState], marks: StepMarks = {}): Step => ({
  kind: "redirect",
  location,
  cookies,
  ...marks,
});
/** A redirect that ends the sign-in without a session, for PostHog's `reason` (issue 781). */
const fail = (location: string, failure: NonNullable<StepMarks["failure"]>): Step =>
  go(location, undefined, { failure });

/** GET /api/w/login: the state cookie, then Discord. */
export function startChooserSignIn(deps: SignInDeps, origin: string): Step {
  const config = discordConfig(deps.env);
  if (!config) return fail(`${PAGE}?e=not_configured`, "not_configured");
  const state = `${CHOOSER_STATE_PREFIX}${randomBytes(32).toString("base64url")}`;
  const location = authorizeUrl(config, `${origin}${CALLBACK_PATH}`, state, false, CHOOSER_SCOPES);
  return go(location, [`${STATE_COOKIE}=${state}; ${cookieAttributes(STATE_MS)}`], {
    authorize: true,
  });
}

const guildsSchema = z.array(z.object({ id: z.string().regex(/^\d{1,20}$/) }).passthrough());

/**
 * The callback's chooser branch. None let in: back to /w with "not in any alliance here". One: straight to
 * it (the desk, or the board for a member). More: /w, which lists them.
 */
export async function finishChooserSignIn(
  db: Db,
  deps: SignInDeps,
  input: CallbackInput,
): Promise<Step> {
  const refused = await stateRefusal(db, input, deps.now);
  if (refused) return refused;
  const config = discordConfig(deps.env);
  if (!config) return fail(`${PAGE}?e=not_configured`, "not_configured");
  const code = input.query.get("code");
  if (input.query.has("error") || !code) return fail(`${PAGE}?e=denied`, "denied");
  const account = await readAccount(deps.fetch, config, code, `${input.origin}${CALLBACK_PATH}`);
  if (!account) {
    privateLog("w.chooser.discord", {});
    return fail(`${PAGE}?e=discord`, "discord");
  }
  // INVARIANT chooser.servers-dropped: the server list is matched here and goes nowhere else.
  const found = await workspacesOnServers(db, account.servers);
  const cookies: (string | null)[] = [];
  const homes: string[] = [];
  for (const workspace of found.slice(0, MAX_SERVERS)) {
    const made = await openOne(db, deps.now, workspace, account, input.cookies);
    if (!made) continue;
    cookies.push(made.cookie);
    homes.push(made.home);
  }
  privateLog("w.chooser", { matched: found.length, admitted: homes.length });
  if (homes.length === 0) return fail(`${PAGE}?e=none`, "none");
  return landing(deps.env, homes.length === 1 ? homes.join("") : PAGE, cookies);
}

type Account = { get: (path: string) => Promise<unknown>; user: { id: string; name: string } };

/** Who the account is and the ids of its servers, read once with its token; null when Discord failed. */
async function readAccount(
  doFetch: typeof fetch,
  config: NonNullable<ReturnType<typeof discordConfig>>,
  code: string,
  redirectUri: string,
): Promise<(Account & { servers: string[] }) | null> {
  const get = await exchangeCode(doFetch, config, code, redirectUri);
  if (!get) return null;
  const user = userSchema.safeParse(await get("/users/@me"));
  const guilds = guildsSchema.safeParse(await get("/users/@me/guilds"));
  if (!user.success || !guilds.success) return null;
  return { get, user: user.data, servers: guilds.data.map((g) => g.id) };
}

/** One matched workspace: the person's roles there, then its own rules; null when they do not pass. */
async function openOne(
  db: Db,
  now: Date,
  workspace: WorkspaceRow,
  account: Account,
  cookies: CallbackInput["cookies"],
) {
  const member = await memberIn(account.get, workspace.discordGuildId, account.user);
  // INVARIANT chooser.keep-on-error: Discord failing here (a timeout, a 429, a bad answer) is not a refusal,
  // so a session this browser holds in that workspace is kept (D131's exception to D99).
  if (!member.ok) return null;
  const token = sessionToken(cookies, workspace.slug)?.value;
  // INVARIANT chooser.same-rules: the same refusal and tier as the workspace's own sign-in.
  const pass = await refusalFor(db, workspace, member, now);
  if (!pass.why) return admit(db, workspace, member, pass, { now, token, back: null });
  // D99's renewal-or-out: Discord just said this person no longer passes here.
  if (token) await revokeSession(db, workspace.id, token);
  return null;
}

/** What Next's `cookies()` returns, reduced to the one call made here. */
export interface CookieList {
  getAll(): { name: string; value: string }[];
}

export interface ChooserRow {
  slug: string;
  tag: string;
  name: string;
  tier: SessionTier;
  /** The desk, or the board for a member. */
  href: string;
}

/**
 * The workspaces this browser is signed in to: one row per session cookie whose session is still open, of
 * the workspace its name says, and not blocked. A member's session in a workspace whose board is closed is
 * left out, since it would not open.
 */
export async function chooserView(db: Db, jar: CookieList, now: Date): Promise<ChooserRow[]> {
  const prefix = `${SESSION_COOKIE}.`;
  const held = jar
    .getAll()
    .filter((c) => c.value && (c.name === SESSION_COOKIE || c.name.startsWith(prefix)));
  const names = new Set(held.map((c) => c.name));
  const named = new Map(held.map((c) => [hashToken(c.value), c.name]));
  const rows = await sessionsByHashes(db, [...named.keys()]);
  const open = rows.filter((r) => {
    // INVARIANT chooser.own-cookie: a cookie copied under another workspace's name lists nothing, and the
    // cookie of before D131 counts only where the workspace has none of its own: the doors' own rule.
    if (sessionCookieFor((n) => names.has(n), r.slug) !== named.get(r.tokenHash)) return false;
    if (r.expiresAt.getTime() <= now.getTime() || r.blocked) return false;
    return r.tier === "officer" || r.memberRoleIds.length > 0;
  });
  const listed = await Promise.all(
    open.map(async (r) => ({
      slug: r.slug,
      ...(await allianceOf(db, r.unionId)),
      tier: r.tier,
      href: r.tier === "member" ? `/w/${r.slug}/board` : `/w/${r.slug}`,
    })),
  );
  return listed.sort((a, b) => a.tag.localeCompare(b.tag));
}
