import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  allowUser,
  allowUserUntil,
  findWorkspaceBySlug,
  saveWorkspace,
  signOutWorkspace,
} from "../repo/workspaces";
import { authAttempts, workspaceSessions, workspaceUsers } from "../schema";
import { requireBoard, requireWorkspace, signOut } from "./access";
import {
  CHECK_MS,
  hashToken,
  MEMBER_SESSION_MS,
  RENEW_MS,
  revokeSession,
  SESSION_COOKIE,
  SESSION_MS,
} from "./session";
import { finishSignIn, startSignIn, STATE_COOKIE } from "./sign-in";
import {
  cookieValue,
  deps,
  jar,
  location,
  MEMBER_ID,
  ORIGIN,
  R4,
  signInWith,
} from "./sign-in.test-helpers";

let db: Db;
const signIn = (...args: Parameters<typeof signInWith> extends [Db, ...infer R] ? R : never) =>
  signInWith(db, ...args);
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

const workspaceId = async (slug: string) => (await findWorkspaceBySlug(db, slug))?.id ?? 0;

describe("workspace sign-in (D71)", () => {
  it("lets in an account with a leadership role and opens the workspace with its session", async () => {
    const { step, token } = await signIn("ogs", "officer");
    expect(location(step)).toBe("/w/ogs");
    const access = await requireWorkspace(db, "ogs", jar(token), T0);
    expect(access.ok && access.user.displayName).toBe("Nick");
  });

  it("marks the redirect #signed-in for analytics only on production with a PostHog key (D77)", async () => {
    const on = { VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" };
    expect(location((await signIn("ogs", "officer", T0, on)).step)).toBe("/w/ogs#signed-in");
    const preview = { VERCEL_ENV: "preview", POSTHOG_KEY: "phc_test" };
    expect(location((await signIn("ogs", "officer", T0, preview)).step)).toBe("/w/ogs");
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

  it("refuses an account outside the server whose allowlist entry has expired", async () => {
    const outsider = "200000000000000003";
    await allowUser(db, await workspaceId("ogs"), outsider, new Date(T0.getTime() - 1), "admin");
    const { step, token } = await signIn("ogs", "outsider");
    expect(location(step)).toBe("/w/ogs/no-access?why=allowlist_expired");
    expect(token).toBeUndefined();
  });

  it("gives a server member without the role the members' board only, for 30 days (D105)", async () => {
    const { step, token } = await signIn("ogs", "member", T0, {}, { next: "/w/ogs/members" });
    expect(location(step)).toBe("/w/ogs/board");
    const cookie = step.kind === "redirect" ? step.cookies.join(" ") : "";
    expect(cookie).toContain(`Max-Age=${MEMBER_SESSION_MS / 1000};`);
    expect(await requireWorkspace(db, "ogs", jar(token), T0)).toEqual({
      ok: false,
      reason: "member",
    });
    // No daily role check: still served on day 29, through Discord again after day 30.
    const day29 = new Date(T0.getTime() + MEMBER_SESSION_MS - 86_400_000);
    expect(await requireBoard(db, "ogs", jar(token), day29)).toMatchObject({
      ok: true,
      officer: false,
    });
    const day30 = new Date(T0.getTime() + MEMBER_SESSION_MS);
    expect(await requireBoard(db, "ogs", jar(token), day30)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("lets an officer's session see the board, and gives an account outside the server nothing", async () => {
    const { token } = await signIn("ogs", "officer");
    expect(await requireBoard(db, "ogs", jar(token), T0)).toMatchObject({
      ok: true,
      officer: true,
    });
    const outsider = await signIn("ogs", "outsider");
    expect(location(outsider.step)).toBe("/w/ogs/no-access?why=not_member");
    expect(outsider.token).toBeUndefined();
    expect(await db.select().from(workspaceUsers)).toHaveLength(1);
  });

  it("refuses a state that does not match its cookie and counts it in auth_attempts", async () => {
    const start = await startSignIn(db, deps(), "ogs", ORIGIN, false);
    const state = cookieValue(start, STATE_COOKIE) ?? "";
    const query = new URLSearchParams({ state: `${state}x`, code: "officer" });
    const step = await finishSignIn(db, deps(), {
      query,
      stateCookie: state,
      sessionCookie: undefined,
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

  it("serves a session for 24 hours after its role check; a page asks for a renewal after 23 hours", async () => {
    const { token } = await signIn("ogs", "officer");
    const at = (ms: number) => new Date(T0.getTime() + ms);
    expect((await requireWorkspace(db, "ogs", jar(token), at(RENEW_MS - 1), RENEW_MS)).ok).toBe(
      true,
    );
    const page = await requireWorkspace(db, "ogs", jar(token), at(RENEW_MS), RENEW_MS);
    expect(page).toMatchObject({ reason: "expired" });
    // An API call keeps working until the hour, then answers signed_out; the session row stays.
    expect((await requireWorkspace(db, "ogs", jar(token), at(CHECK_MS - 1))).ok).toBe(true);
    expect((await requireWorkspace(db, "ogs", jar(token), at(CHECK_MS))).ok).toBe(false);
    expect(await db.select().from(workspaceSessions)).toHaveLength(1);
  });

  it("renews the same session through Discord, until seven days after sign-in", async () => {
    const { token } = await signIn("ogs", "officer");
    // Renewed a day after sign-in and a minute before the cap: same cookie, served again each time.
    for (const ms of [CHECK_MS + 60_000, SESSION_MS - 60_000]) {
      const now = new Date(T0.getTime() + ms);
      expect((await requireWorkspace(db, "ogs", jar(token), now, RENEW_MS)).ok).toBe(false);
      const renewal = await signIn("ogs", "officer", now, {}, { session: token ?? "" });
      expect(renewal.token).toBeUndefined();
      expect((await requireWorkspace(db, "ogs", jar(token), now, RENEW_MS)).ok).toBe(true);
    }
    // The cap: seven days after sign-in the session ends, and the next trip makes a new one.
    const end = new Date(T0.getTime() + SESSION_MS);
    expect(await requireWorkspace(db, "ogs", jar(token), end)).toMatchObject({ reason: "expired" });
    const fresh = await signIn("ogs", "officer", end, {}, { session: token ?? "" });
    expect(fresh.token !== undefined && fresh.token !== token).toBe(true);
    expect(await db.select().from(workspaceSessions)).toHaveLength(1);
  });

  it("takes access away at the next renewal from an officer who lost the role (ADV-8)", async () => {
    const { token } = await signIn("ogs", "officer");
    const later = new Date(T0.getTime() + RENEW_MS);
    const renewal = await signIn("ogs", "demoted", later, {}, { session: token ?? "" });
    // Still in the server: a member now (D105). The officer's session is gone.
    expect(location(renewal.step)).toBe("/w/ogs/board");
    expect(await requireWorkspace(db, "ogs", jar(token), later)).toMatchObject({
      reason: "signed_out",
    });
    expect(await requireWorkspace(db, "ogs", jar(renewal.token), later)).toMatchObject({
      reason: "member",
    });
  });

  it("ends the session when Discord does not confirm the renewal, so the page shows the sign-in", async () => {
    const { token } = await signIn("ogs", "officer");
    const later = new Date(T0.getTime() + RENEW_MS);
    const opts = { session: token ?? "", error: "login_required" };
    const renewal = await signIn("ogs", "officer", later, {}, opts);
    expect(location(renewal.step)).toBe("/w/ogs?e=denied");
    expect((await requireWorkspace(db, "ogs", jar(token), later)).ok).toBe(false);
    expect(await db.select().from(workspaceSessions)).toEqual([]);
  });

  it("returns to the page the officer came from, and drops a return outside the workspace", async () => {
    const back = await signIn("ogs", "officer", T0, {}, { next: "/w/ogs/shots/5?x=1#top" });
    expect(location(back.step)).toBe("/w/ogs/shots/5?x=1");
    const away = await signIn("ogs", "officer", T0, {}, { next: "https://evil.example/w/ogs" });
    expect(location(away.step)).toBe("/w/ogs");
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

  it("ends a session let in only by the allowlist when the entry ends, before seven days", async () => {
    const entryEnds = new Date(T0.getTime() + 2 * 3_600_000);
    await allowUser(db, await workspaceId("ogs"), MEMBER_ID, entryEnds, "admin");
    const { step, token } = await signIn("ogs", "member");
    const cookie = step.kind === "redirect" ? step.cookies.join(" ") : "";
    expect(cookie).toContain(`${SESSION_COOKIE}=${token}; Path=/; Max-Age=7200;`);
    const after = new Date(entryEnds.getTime() + 1);
    expect(await requireWorkspace(db, "ogs", jar(token), after)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("deletes sessions past their end when a new session is made", async () => {
    await signIn("ogs", "officer");
    const { token } = await signIn("ogs", "officer", new Date(T0.getTime() + SESSION_MS));
    const rows = await db.select().from(workspaceSessions);
    expect(rows.map((r) => r.tokenHash)).toEqual([hashToken(token ?? "")]);
  });
});

describe("two workspaces stay apart (D71)", () => {
  const allowInOgs = async () =>
    allowUser(
      db,
      await workspaceId("ogs"),
      MEMBER_ID,
      new Date(T0.getTime() + 86_400_000),
      "admin",
    );

  it("does not let an account in through another workspace's allowlist", async () => {
    await allowInOgs();
    const { step, token } = await signIn("nse", "member");
    expect(location(step)).toBe("/w/nse/board");
    expect(await requireWorkspace(db, "nse", jar(token), T0)).toMatchObject({ reason: "member" });
  });

  it("does not end a session when it signs out under another workspace's slug", async () => {
    const { token } = await signIn("ogs", "officer");
    expect(await signOut(db, "nse", jar(token), T0)).toBe(false);
    expect((await requireWorkspace(db, "ogs", jar(token), T0)).ok).toBe(true);
  });

  it("does not end a session when another workspace revokes its token", async () => {
    const { token } = await signIn("ogs", "officer");
    await revokeSession(db, await workspaceId("nse"), token ?? "");
    expect((await requireWorkspace(db, "ogs", jar(token), T0)).ok).toBe(true);
  });

  it("does not end a workspace's sessions when another workspace signs out everyone", async () => {
    const { token } = await signIn("ogs", "officer");
    expect(await signOutWorkspace(db, await workspaceId("nse"))).toBe(0);
    expect((await requireWorkspace(db, "ogs", jar(token), T0)).ok).toBe(true);
  });

  it("stores a person only under the workspace they signed in to", async () => {
    await signIn("ogs", "officer");
    const rows = await db.select().from(workspaceUsers);
    expect(rows.map((r) => r.workspaceId)).toEqual([await workspaceId("ogs")]);
  });
});

describe("the /admin allowlist entry (D73)", () => {
  it("lets the account in until the end of the chosen day, UTC", async () => {
    const id = await workspaceId("ogs");
    expect(await allowUserUntil(db, id, MEMBER_ID, "2026-11-30", T0)).toBe("ok");
    const [row] = await db.select().from(workspaceUsers);
    expect(row?.allowlistExpiresAt?.toISOString()).toBe("2026-11-30T23:59:59.999Z");
    expect(row?.allowlistAddedBy).toBe("admin");
  });

  it("refuses a day that is already over", async () => {
    const yesterday = new Date(T0.getTime() - 86_400_000).toISOString().slice(0, 10);
    expect(await allowUserUntil(db, await workspaceId("ogs"), MEMBER_ID, yesterday, T0)).toBe(
      "expiry_past",
    );
  });

  it("refuses a workspace that does not exist", async () => {
    expect(await allowUserUntil(db, 999, MEMBER_ID, "2099-01-01", T0)).toBe("not_found");
  });
});
