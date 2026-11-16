import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_ENV } from "../app-context.test-helpers";
import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  allowUser,
  findWorkspaceBySlug,
  saveWorkspace,
  signOutWorkspace,
} from "../repo/workspaces";
import { authAttempts, workspaceSessions, workspaceUsers } from "../schema";
import { requireWorkspace, signOut, type CookieReader } from "./access";
import { revokeSession, SESSION_COOKIE, SESSION_MS } from "./session";
import { finishSignIn, startSignIn, STATE_COOKIE, type Step } from "./sign-in";

const ORIGIN = "https://laptracker.test";
const R4 = "300000000000000001";
const MEMBER_ROLE = "300000000000000009";
const MEMBER_ID = "200000000000000002";
const env = {
  ...TEST_ENV,
  DISCORD_CLIENT_ID: "100000000000000001",
  DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  DISCORD_API_BASE_URL: "https://discord.test/api",
};

/** A stand-in for Discord: the OAuth code names the account; roles null = not in the server. */
const ACCOUNTS: Record<string, { id: string; roles: string[] | null }> = {
  officer: { id: "200000000000000001", roles: [MEMBER_ROLE, R4] },
  member: { id: MEMBER_ID, roles: [MEMBER_ROLE] },
  outsider: { id: "200000000000000003", roles: null },
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

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "400000000000000001",
    leaderRoleIds: [R4],
  });
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "400000000000000002",
    leaderRoleIds: ["300000000000000077"],
  });
});

const deps = (now = T0) => ({ env, fetch: discord, now });
const cookieValue = (step: Step, name: string) =>
  step.kind === "redirect"
    ? step.cookies
        .find((c) => c.startsWith(`${name}=`))
        ?.split(";")[0]
        ?.slice(name.length + 1)
    : undefined;
const jar = (token: string | undefined): CookieReader => ({
  get: (name) => (name === SESSION_COOKIE && token ? { value: token } : undefined),
});

/** The whole round trip: login sets the state cookie, Discord answers with `code`. */
async function signIn(slug: string, code: string, now = T0) {
  const start = await startSignIn(db, deps(now), slug, ORIGIN, false);
  const state = cookieValue(start, STATE_COOKIE) ?? "";
  const query = new URLSearchParams({ state, code });
  const step = await finishSignIn(db, deps(now), {
    query,
    stateCookie: state,
    ip: "198.51.100.1",
    origin: ORIGIN,
  });
  return { step, token: cookieValue(step, SESSION_COOKIE) };
}
const location = (step: Step) => (step.kind === "redirect" ? step.location : step.code);
const workspaceId = async (slug: string) => (await findWorkspaceBySlug(db, slug))?.id ?? 0;

describe("workspace sign-in (D71)", () => {
  it("lets in an account with a leadership role and opens the workspace with its session", async () => {
    const { step, token } = await signIn("ogs", "officer");
    expect(location(step)).toBe("/w/ogs");
    const access = await requireWorkspace(db, "ogs", jar(token), T0);
    expect(access.ok && access.user.displayName).toBe("Nick");
  });

  it("lets in an account through an allowlist entry that has not expired", async () => {
    await allowUser(
      db,
      await workspaceId("ogs"),
      MEMBER_ID,
      new Date(T0.getTime() + 86_400_000),
      "admin",
    );
    const { step, token } = await signIn("ogs", "member");
    expect(location(step)).toBe("/w/ogs");
    expect((await requireWorkspace(db, "ogs", jar(token), T0)).ok).toBe(true);
  });

  it("refuses an account whose allowlist entry has expired", async () => {
    await allowUser(db, await workspaceId("ogs"), MEMBER_ID, new Date(T0.getTime() - 1), "admin");
    const { step, token } = await signIn("ogs", "member");
    expect(location(step)).toBe("/w/ogs/no-access?why=allowlist_expired");
    expect(token).toBeUndefined();
  });

  it("gives no access to an account without the role, and stores nothing about it", async () => {
    const { step, token } = await signIn("ogs", "member");
    expect(location(step)).toBe("/w/ogs/no-access?why=no_role");
    expect(token).toBeUndefined();
    expect(await db.select().from(workspaceUsers)).toEqual([]);
    expect(location((await signIn("ogs", "outsider")).step)).toBe(
      "/w/ogs/no-access?why=not_member",
    );
  });

  it("refuses a state that does not match its cookie and counts it in auth_attempts", async () => {
    const start = await startSignIn(db, deps(), "ogs", ORIGIN, false);
    const state = cookieValue(start, STATE_COOKIE) ?? "";
    const query = new URLSearchParams({ state: `${state}x`, code: "officer" });
    const step = await finishSignIn(db, deps(), {
      query,
      stateCookie: state,
      ip: "198.51.100.1",
      origin: ORIGIN,
    });
    expect(step).toEqual({ kind: "refused", status: 400, code: "bad_state" });
    const [row] = await db
      .select()
      .from(authAttempts)
      .where(eq(authAttempts.key, "w:ip:198.51.100.1"));
    expect(row?.count).toBe(1);
    expect(await db.select().from(workspaceSessions)).toEqual([]);
  });

  it("refuses a session older than 24 hours, so Discord is asked again", async () => {
    const { token } = await signIn("ogs", "officer");
    const later = new Date(T0.getTime() + SESSION_MS);
    expect(await requireWorkspace(db, "ogs", jar(token), later)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(await db.select().from(workspaceSessions)).toEqual([]);
  });

  it("refuses a session of one workspace under another workspace's slug", async () => {
    const { token } = await signIn("ogs", "officer");
    expect(await requireWorkspace(db, "nse", jar(token), T0)).toEqual({
      ok: false,
      reason: "other_workspace",
    });
  });

  it("ends every session of a workspace with Sign out everyone", async () => {
    const first = await signIn("ogs", "officer");
    const second = await signIn("ogs", "officer");
    expect(await signOutWorkspace(db, await workspaceId("ogs"))).toBe(2);
    for (const { token } of [first, second]) {
      expect(await requireWorkspace(db, "ogs", jar(token), T0)).toEqual({
        ok: false,
        reason: "signed_out",
      });
    }
  });

  it("keeps two workspaces apart: neither one's allowlist, sessions nor sign-out reach the other", async () => {
    await allowUser(
      db,
      await workspaceId("ogs"),
      MEMBER_ID,
      new Date(T0.getTime() + 86_400_000),
      "admin",
    );
    expect(location((await signIn("nse", "member")).step)).toBe("/w/nse/no-access?why=no_role");
    const { token } = await signIn("ogs", "member");
    // Signing out, or revoking, under the other workspace leaves this session alone.
    expect(await signOut(db, "nse", jar(token), T0)).toBe(false);
    await revokeSession(db, await workspaceId("nse"), token ?? "");
    await signOutWorkspace(db, await workspaceId("nse"));
    expect((await requireWorkspace(db, "ogs", jar(token), T0)).ok).toBe(true);
    const rows = await db.select().from(workspaceUsers);
    expect(rows.map((r) => r.workspaceId)).toEqual([await workspaceId("ogs")]);
  });
});
