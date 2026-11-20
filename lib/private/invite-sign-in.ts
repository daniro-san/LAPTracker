// Signing in through an invite (D130, issue 453): Discord with the scopes `identify guilds`, through D73's one
// callback, the state starting `invite.` so the callback sends it here. Discord's server list is read once,
// on the server, and kept with the invite only as the servers she owns or may manage (dropped when the link
// is used). Once a server is picked, that account keeps the invite; the browser gets a claim cookie for the
// steps after.
import { randomBytes } from "node:crypto";

import { IP_LIMIT, IP_WINDOW_MS, secretEquals } from "../auth";
import type { Db } from "../db";
import { claimInvite, sha256 } from "../repo/alliance-invites";
import { currentCount, recordFailure } from "../repo/auth-attempts";
import { authorizeUrl, discordConfig, exchangeCode, userSchema } from "./discord";
import {
  CLAIM_COOKIE,
  closedWhy,
  INVITE_COOKIE,
  INVITE_COOKIE_MS,
  inviteFrom,
  type CookieJar,
} from "./invite";
import { manageable } from "./invite-discord";
import { privateLog } from "./log";
import { cookieAttributes } from "./session";
import { CALLBACK_PATH, STATE_COOKIE, STATE_MS, type SignInDeps, type Step } from "./sign-in";

export const INVITE_SCOPES = "identify guilds";
export const INVITE_STATE_PREFIX = "invite.";
const PAGE = "/w/invite";

const clearState = `${STATE_COOKIE}=; ${cookieAttributes(0)}`;
const go = (location: string, cookies: string[] = [clearState]): Step => ({
  kind: "redirect",
  location,
  cookies,
});

/** GET /api/w/invite/login: the state cookie, then Discord's page asking for `identify guilds`. */
export async function startInviteSignIn(
  db: Db,
  deps: SignInDeps,
  jar: CookieJar,
  origin: string,
): Promise<Step> {
  const config = discordConfig(deps.env);
  if (!config) return go(`${PAGE}?e=not_configured`);
  const row = await inviteFrom(db, jar.get(INVITE_COOKIE)?.value);
  if (!row || closedWhy(row, deps.now)) return go(PAGE);
  const state = `${INVITE_STATE_PREFIX}${randomBytes(32).toString("base64url")}`;
  const location = authorizeUrl(config, `${origin}${CALLBACK_PATH}`, state, false, INVITE_SCOPES);
  return go(location, [`${STATE_COOKIE}=${state}; ${cookieAttributes(STATE_MS)}`]);
}

export interface InviteCallback {
  query: URLSearchParams;
  stateCookie: string | undefined;
  jar: CookieJar;
  ip: string;
  origin: string;
}

/**
 * D73's state rule: past the IP's limit, or a state that is not the cookie's (counted), is refused. Also the
 * sign-in chooser's (D131).
 */
export async function stateRefusal(
  db: Db,
  input: Pick<InviteCallback, "query" | "stateCookie" | "ip">,
  now: Date,
): Promise<Step | null> {
  const ipKey = `w:ip:${input.ip}`;
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, now)) >= IP_LIMIT) {
    return { kind: "refused", status: 429, code: "rate_limited" };
  }
  const given = input.query.get("state");
  if (input.stateCookie && given && secretEquals(given, input.stateCookie)) return null;
  const count = await recordFailure(db, ipKey, IP_WINDOW_MS, now);
  privateLog("w.state_bad", { count });
  return { kind: "refused", status: 400, code: "bad_state" };
}

/** The account and the servers it may pick, read once with its token; null when Discord did not answer. */
async function readAccount(
  doFetch: typeof fetch,
  config: NonNullable<ReturnType<typeof discordConfig>>,
  code: string,
  redirectUri: string,
) {
  const get = await exchangeCode(doFetch, config, code, redirectUri);
  if (!get) return null;
  const user = userSchema.safeParse(await get("/users/@me"));
  if (!user.success) return null;
  const guilds = manageable(await get("/users/@me/guilds"));
  return guilds ? { ...user.data, guilds } : null;
}

/** The callback's invite branch: a bad state counts like a sign-in's (D73); else back to /w/invite. */
export async function finishInviteSignIn(
  db: Db,
  deps: SignInDeps,
  input: InviteCallback,
): Promise<Step> {
  const refused = await stateRefusal(db, input, deps.now);
  if (refused) return refused;
  const config = discordConfig(deps.env);
  if (!config) return go(`${PAGE}?e=not_configured`);
  const row = await inviteFrom(db, input.jar.get(INVITE_COOKIE)?.value);
  if (!row || closedWhy(row, deps.now)) return go(PAGE);
  const code = input.query.get("code");
  if (input.query.has("error") || !code) return go(`${PAGE}?e=denied`);
  const account = await readAccount(deps.fetch, config, code, `${input.origin}${CALLBACK_PATH}`);
  if (!account) {
    privateLog("w.invite.discord", { invite: row.id });
    return go(`${PAGE}?e=discord`);
  }
  const { guilds } = account;
  const claim = randomBytes(32).toString("base64url");
  const who = { discordId: account.id, name: account.name, claimHash: sha256(claim), guilds };
  // INVARIANT invite.one-account: once a server is picked, only the account that picked it goes on.
  if (!(await claimInvite(db, row.id, who, deps.now))) {
    privateLog("w.invite.other_account", { invite: row.id });
    return go(`${PAGE}?e=claimed`);
  }
  privateLog("w.invite.signed_in", { invite: row.id, servers: guilds.length });
  const cookie = `${CLAIM_COOKIE}=${claim}; ${cookieAttributes(INVITE_COOKIE_MS)}`;
  return go(PAGE, [clearState, cookie]);
}
