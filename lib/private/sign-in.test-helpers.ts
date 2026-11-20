// The workspace sign-in's test fixture (D71, D99): a stand-in for Discord, and the whole round trip.
// Invented ids only; no test calls the real Discord.
import { TEST_ENV } from "../app-context.test-helpers";
import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import type { CookieReader } from "./access";
import { SESSION_COOKIE, sessionCookieName } from "./session";
import { finishSignIn, startSignIn, STATE_COOKIE, type Step } from "./sign-in";

export const ORIGIN = "https://laptracker.test";
export const R4 = "300000000000000001";
export const MEMBER_ROLE = "300000000000000009";
export const MEMBER_ID = "200000000000000002";
export const env = {
  ...TEST_ENV,
  DISCORD_CLIENT_ID: "100000000000000001",
  DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  DISCORD_API_BASE_URL: "https://discord.test/api",
};

/** A stand-in for Discord: the OAuth code names the account; roles null = not in the server. */
const ACCOUNTS: Record<string, { id: string; roles: string[] | null }> = {
  officer: { id: "200000000000000001", roles: [MEMBER_ROLE, R4] },
  /** The same person after an R5 took the R4 role away. */
  demoted: { id: "200000000000000001", roles: [MEMBER_ROLE] },
  member: { id: MEMBER_ID, roles: [MEMBER_ROLE] },
  /** The same member after an R5 gave them the R4 role (D105). */
  promoted: { id: MEMBER_ID, roles: [MEMBER_ROLE, R4] },
  outsider: { id: "200000000000000003", roles: null },
  /** In the server, not sorted yet: no member role (D105, amended 2026-11-17). */
  guest: { id: "200000000000000004", roles: [] },
  /** The member after an officer took the member role away. */
  unsorted: { id: MEMBER_ID, roles: [] },
};
const discord: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith("/oauth2/token")) {
    const code = new URLSearchParams(String(init?.body)).get("code") ?? "";
    return ACCOUNTS[code]
      ? Response.json({ access_token: code })
      : new Response(null, { status: 400 });
  }
  const account = ACCOUNTS[String(new Headers(init?.headers).get("authorization")).slice(7)];
  if (!account) return new Response(null, { status: 401 });
  if (url.endsWith("/users/@me")) return Response.json({ id: account.id, username: "someone" });
  if (account.roles === null) return Response.json({ code: 10004 }, { status: 404 });
  return Response.json({ nick: "Nick", roles: account.roles });
};

export const deps = (now = T0, more: Partial<typeof env> = {}) => ({
  env: { ...env, ...more },
  fetch: discord,
  now,
});
export const cookieValue = (step: Step, name: string) =>
  step.kind === "redirect"
    ? step.cookies
        .find((c) => c.startsWith(`${name}=`))
        ?.split(";")[0]
        ?.slice(name.length + 1)
    : undefined;
export const jar = (token: string | undefined): CookieReader => ({
  get: (name) => (name === SESSION_COOKIE && token ? { value: token } : undefined),
});
export const location = (step: Step) => (step.kind === "redirect" ? step.location : step.code);

/**
 * The whole round trip: login sets the state cookie, Discord answers with `code`. `o.session` is the
 * browser's session cookie, `o.next` the page asked for, `o.error` Discord's answer instead of a code.
 */
export async function signInWith(
  db: Db,
  slug: string,
  code: string,
  now = T0,
  more: Partial<typeof env> = {},
  o: { session?: string; next?: string; error?: string } = {},
) {
  const start = await startSignIn(db, deps(now, more), slug, ORIGIN, false, o.next);
  const state = cookieValue(start, STATE_COOKIE) ?? "";
  const query = new URLSearchParams(o.error ? { state, error: o.error } : { state, code });
  const step = await finishSignIn(db, deps(now, more), {
    query,
    stateCookie: state,
    cookies: jar(o.session),
    ip: "198.51.100.1",
    origin: ORIGIN,
  });
  return { step, token: cookieValue(step, sessionCookieName(slug)) };
}
