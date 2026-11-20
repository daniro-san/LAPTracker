// The sign-in chooser at /w (D131, issue 457): one Discord sign-in, every workspace the account may open, each
// checked by the workspace's own rules, and the list read from this browser's own cookies. A stand-in for
// Discord; invented ids only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { saveWorkspace } from "../repo/workspaces";
import { requireBoard, requireWorkspace } from "./access";
import { chooserView, finishChooserSignIn, startChooserSignIn, type CookieList } from "./chooser";
import { sessionCookieName } from "./session";
import { STATE_COOKIE, type CallbackInput, type Step } from "./sign-in";
import { cookieValue, env, location, ORIGIN } from "./sign-in.test-helpers";

const SERVER = { ogs: "400000000000000001", nse: "400000000000000002", ursa: "400000000000000003" };
const LEAD = "300000000000000001";
const MEMBER = "300000000000000009";
/** A server the account is in that has no workspace. */
const OTHER = "400000000000000099";

/** The code names the account: its servers and its roles in each. */
const ACCOUNTS: Record<string, Record<string, string[]>> = {
  twoAlliances: { [SERVER.ogs]: [LEAD], [SERVER.nse]: [MEMBER], [OTHER]: [] },
  memberOnly: { [SERVER.nse]: [MEMBER], [OTHER]: [] },
  guestEverywhere: { [SERVER.ogs]: [], [OTHER]: [] },
  /** Discord answers 500 to every role read of this account. */
  discordDown: { [SERVER.ogs]: [LEAD], [OTHER]: [] },
};
const reads: string[] = [];
const discord: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith("/oauth2/token")) {
    const code = new URLSearchParams(String(init?.body)).get("code") ?? "";
    return Response.json({ access_token: code });
  }
  const servers = ACCOUNTS[String(new Headers(init?.headers).get("authorization")).slice(7)] ?? {};
  reads.push(url.replace("https://discord.test/api", ""));
  if (url.endsWith("/users/@me"))
    return Response.json({ id: "200000000000000001", username: "Ottoline" });
  if (url.endsWith("/users/@me/guilds")) {
    return Response.json(
      Object.keys(servers).map((id) => ({ id, name: `Server ${id.slice(-2)}` })),
    );
  }
  const id = /guilds\/(\d+)\/member$/.exec(url)?.[1] ?? "";
  if (servers === ACCOUNTS.discordDown) return new Response(null, { status: 500 });
  const roles = servers[id];
  return roles ? Response.json({ nick: null, roles }) : new Response(null, { status: 404 });
};

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  reads.length = 0;
  for (const [slug, unionId] of [
    ["ogs", 67111155],
    ["nse", 67109944],
    ["ursa", 67110320],
  ] as const) {
    await saveWorkspace(db, {
      unionId,
      slug,
      discordGuildId: SERVER[slug],
      leaderRoleIds: [LEAD],
      memberRoleIds: [MEMBER],
    });
  }
});

const deps = { env, fetch: discord, now: T0 };

/** `held`: the browser's cookies before this sign-in (none by default). */
async function chooserSignIn(
  code: string,
  held: CallbackInput["cookies"] = { get: () => undefined },
): Promise<Step> {
  const start = startChooserSignIn(deps, ORIGIN);
  const state = cookieValue(start, STATE_COOKIE) ?? "";
  return finishChooserSignIn(db, deps, {
    query: new URLSearchParams({ state, code }),
    stateCookie: state,
    cookies: held,
    ip: "198.51.100.1",
    origin: ORIGIN,
  });
}

/** The browser after the callback: the session cookies it set, by name. */
const browser = (step: Step): CookieList & { get(name: string): { value: string } | undefined } => {
  const set = step.kind === "redirect" ? step.cookies : [];
  const all = set
    .map((c) => c.split(";")[0] ?? "")
    .map((c) => ({ name: c.slice(0, c.indexOf("=")), value: c.slice(c.indexOf("=") + 1) }))
    .filter((c) => c.value);
  return { getAll: () => all, get: (name) => all.find((c) => c.name === name) };
};

describe("the sign-in chooser (D131)", () => {
  it("asks Discord for the servers and the roles, through the one callback", () => {
    const step = startChooserSignIn(deps, ORIGIN);
    const url = new URL(location(step));
    expect(url.searchParams.get("scope")).toBe("identify guilds.members.read guilds");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/w/auth/callback`);
    expect(url.searchParams.get("state")?.startsWith("w.")).toBe(true);
  });

  it("signs a person in two alliances on different servers in to both, each at its own tier", async () => {
    const step = await chooserSignIn("twoAlliances");
    expect(location(step)).toBe("/w");
    const jar = browser(step);
    expect(await chooserView(db, jar, T0)).toEqual([
      { slug: "nse", tag: "NSE", name: "Natural Selection", tier: "member", href: "/w/nse/board" },
      { slug: "ogs", tag: "OGs", name: "OldGrandmas", tier: "officer", href: "/w/ogs" },
    ]);
    expect((await requireWorkspace(db, "ogs", jar, T0)).ok).toBe(true);
    expect(await requireWorkspace(db, "nse", jar, T0)).toEqual({ ok: false, reason: "member" });
    expect((await requireBoard(db, "nse", jar, T0)).ok).toBe(true);
  });

  it("reads roles only on servers that have a workspace, and keeps no server list", async () => {
    await chooserSignIn("twoAlliances");
    expect(reads.filter((r) => r.endsWith("/member")).sort()).toEqual([
      `/users/@me/guilds/${SERVER.ogs}/member`,
      `/users/@me/guilds/${SERVER.nse}/member`,
    ]);
    const stored = JSON.stringify(await db.execute("select * from workspace_users"));
    expect(stored).not.toContain(OTHER);
    expect(stored).not.toContain("Server 99");
  });

  it("goes straight to the only one: the board for a member", async () => {
    const step = await chooserSignIn("memberOnly");
    expect(location(step)).toBe("/w/nse/board");
    expect(step.kind === "redirect" && step.cookies.join(" ")).toContain(
      `${sessionCookieName("nse")}=`,
    );
  });

  it("says the account is in no alliance here when no workspace lets it in, and makes no session", async () => {
    const step = await chooserSignIn("guestEverywhere");
    expect(location(step)).toBe("/w?e=none");
    expect(await chooserView(db, browser(step), T0)).toEqual([]);
  });

  it("ends a session this browser holds in an alliance that now refuses the person (D99)", async () => {
    const jar = browser(await chooserSignIn("twoAlliances"));
    // The same account, after its OGs leadership role was taken away.
    await chooserSignIn("guestEverywhere", jar);
    expect(await requireWorkspace(db, "ogs", jar, T0)).toEqual({ ok: false, reason: "signed_out" });
    expect((await requireBoard(db, "nse", jar, T0)).ok).toBe(true);
  });

  it("keeps a session this browser holds when Discord fails while checking that alliance (D131)", async () => {
    const jar = browser(await chooserSignIn("twoAlliances"));
    expect(location(await chooserSignIn("discordDown", jar))).toBe("/w?e=none");
    expect((await requireWorkspace(db, "ogs", jar, T0)).ok).toBe(true);
  });
});
