// The invite's test fixture (D130, issue 453): a stand-in for Discord (OAuth, the server list, the bot's role
// reads and writes, the commands' PUT) and the trip from the owner's link to a signed-in invite. Invented ids
// and names only; no test calls the real Discord.
import type { AppContext } from "../app-context";
import { TEST_ENV } from "../app-context.test-helpers";
import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { createInvite } from "../repo/alliance-invites";
import { CLAIM_COOKIE, INVITE_COOKIE, openInviteLink, type CookieJar } from "./invite";
import { finishInviteSignIn, startInviteSignIn } from "./invite-sign-in";
import { STATE_COOKIE, type Step } from "./sign-in";

export const ORIGIN = "https://laptracker.test";
/** TheWackyOnes, a tracked alliance: the invite's alliance in these tests. */
export const WACK = 67110992;
export const HER = "700000000000000001";
export const GUILD = "700000000000000101";
export const NOT_MANAGED = "700000000000000102";
export const OTHER_GUILD = "700000000000000103";
export const R5_ROLE = "700000000000000201";
export const MEMBER_ROLE = "700000000000000202";
export const env = {
  ...TEST_ENV,
  DISCORD_CLIENT_ID: "700000000000000901",
  DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  DISCORD_BOT_TOKEN: "bot-token-for-tests-only",
  DISCORD_API_BASE_URL: "https://discord.test/api",
};

/** What the stand-in answers, and every call it received. */
export const discord = {
  botIn: true,
  canManageRoles: true,
  calls: [] as { method: string; url: string; body: string }[],
  account: HER,
  /** Roles created through the bot, listed by later reads. */
  created: [] as ReturnType<typeof role>[],
  /** A role name Discord refuses to create (403). */
  refuse: null as string | null,
  reset() {
    this.botIn = true;
    this.canManageRoles = true;
    this.calls = [];
    this.account = HER;
    this.created = [];
    this.refuse = null;
  },
};

function role(id: string, name: string, position: number) {
  return { id, name, color: 0x8e44ad, position, managed: false };
}

/**
 * The bot's roles: read (403 while the bot is out), or one created (403 without Manage Roles, or for the
 * name `discord.refuse`).
 */
function rolesAnswer(guild: string, method: string, body: string): Response {
  if (method === "GET") {
    if (!discord.botIn) return new Response("", { status: 403 });
    return Response.json([
      role(guild, "@everyone", 0),
      role(R5_ROLE, "R5", 3),
      role(MEMBER_ROLE, "Members", 1),
      ...discord.created,
    ]);
  }
  const name = (JSON.parse(body) as { name: string }).name;
  if (!discord.canManageRoles || name === discord.refuse) {
    return Response.json({ code: 50013 }, { status: 403 });
  }
  const made = role(`70000000000000030${discord.created.length}`, name, 2);
  discord.created.push(made);
  return Response.json(made);
}

export const stub: typeof fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = String(init?.body ?? "");
  discord.calls.push({ method, url, body });
  if (url.endsWith("/oauth2/token")) return Response.json({ access_token: "bearer-test" });
  if (url.endsWith("/users/@me"))
    return Response.json({ id: discord.account, username: "vellamo" });
  if (url.endsWith("/users/@me/guilds")) {
    return Response.json([
      { id: GUILD, name: "Wacky Hall", owner: true, permissions: "0" },
      { id: NOT_MANAGED, name: "Friends", owner: false, permissions: "1024" },
      { id: OTHER_GUILD, name: "Second Hall", owner: false, permissions: "32" },
    ]);
  }
  const roles = /\/guilds\/(\d+)\/roles$/.exec(url);
  if (roles) return rolesAnswer(roles[1] ?? "", method, body);
  if (url.includes("/members/") && method === "PUT") return new Response(null, { status: 204 });
  return Response.json([]);
};

export const deps = (now = T0, report: AppContext["report"] = () => undefined) => ({
  env,
  fetch: stub,
  now,
  report,
});

/** A browser's cookie jar: the cookies each step set, by name. */
export function browser() {
  const cookies = new Map<string, string>();
  const jar: CookieJar = {
    get: (name) => (cookies.has(name) ? { value: cookies.get(name) ?? "" } : undefined),
  };
  const take = (setCookies: readonly string[]) => {
    for (const c of setCookies) {
      const [pair = ""] = c.split(";");
      const at = pair.indexOf("=");
      const value = pair.slice(at + 1);
      if (value === "") cookies.delete(pair.slice(0, at));
      else cookies.set(pair.slice(0, at), value);
    }
  };
  return { jar, cookies, take };
}

/** The owner's link for WACK (or `unionId`), opened in a new browser. */
export async function openedInvite(db: Db, now = T0, unionId = WACK) {
  const made = await createInvite(db, unionId, now);
  const b = browser();
  const opened = await openInviteLink(db, made.credential, "203.0.113.7", now);
  if (!opened.ok) throw new Error(`link refused: ${opened.code}`);
  b.take([opened.cookie]);
  return { ...b, made };
}

/** Sign in through the invite with Discord: login, then the callback with the state Discord sends back. */
export async function signInThrough(db: Db, b: ReturnType<typeof browser>, now = T0) {
  const start = await startInviteSignIn(db, deps(now), b.jar, ORIGIN);
  if (start.kind !== "redirect") throw new Error("login refused");
  b.take(start.cookies);
  const state = b.cookies.get(STATE_COOKIE) ?? "";
  const step: Step = await finishInviteSignIn(db, deps(now), {
    query: new URLSearchParams({ code: "code-test", state }),
    stateCookie: state,
    jar: b.jar,
    ip: "203.0.113.7",
    origin: ORIGIN,
  });
  if (step.kind === "redirect") b.take(step.cookies);
  return step;
}

export { CLAIM_COOKIE, INVITE_COOKIE };
