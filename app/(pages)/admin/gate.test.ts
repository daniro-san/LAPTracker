// Issue 218: every /admin page checks the session before it reads the database.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { adminToken } from "@/lib/admin-session";
import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import { adminCopy } from "@/lib/copy-admin";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import type { Env } from "@/lib/env";
import { appErrors, workspaces } from "@/lib/schema";
import { accessRequests } from "@/lib/schema-invites";

const holder = vi.hoisted(() => ({
  ctx: null as AppContext | null,
  env: null as Env | null,
  cookie: undefined as string | undefined,
}));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof import("@/lib/env")>()),
  getEnv: () => holder.env,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "lap_admin" && holder.cookie !== undefined ? { value: holder.cookie } : undefined,
  }),
  headers: async () => new Headers(),
}));
// withPageDb closes the request's connection in `after` (D141, 2026-11-21), which needs a Next request.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  // The PIN card's router, for its refresh after a sign-in.
  useRouter: () => ({ refresh: () => undefined }),
}));

const { default: AdminPage } = await import("./page");
const { default: RunsPage } = await import("./runs/page");
const { default: ErrorsPage } = await import("./errors/page");
const { default: RunPage } = await import("./runs/[id]/page");
const { default: DailyRunPage } = await import("./runs/daily/[day]/page");

const run = (id: string) => RunPage({ params: Promise.resolve({ id }) });
/** The page as the browser gets it. */
async function html(page: ReactNode): Promise<string> {
  const { prelude } = await prerender(page);
  return new Response(prelude).text();
}
const openDb = vi.fn(() => {
  throw new Error("database opened");
});

beforeEach(() => {
  vi.clearAllMocks();
  holder.env = TEST_ENV;
  holder.cookie = undefined;
  holder.ctx = { ...testContext(null as never).ctx, openDb };
});

describe("/admin pages, locked", () => {
  it.each([
    ["/admin", () => AdminPage()],
    ["/admin/runs", () => RunsPage({ searchParams: Promise.resolve({}) })],
    ["/admin/errors", () => ErrorsPage({ searchParams: Promise.resolve({}) })],
    ["/admin/runs/1", () => run("1")],
    [
      "/admin/runs/daily/2026-11-12",
      () => DailyRunPage({ params: Promise.resolve({ day: "2026-11-12" }) }),
    ],
  ])("%s shows the PIN card, not the page, and opens no database connection", async (_, page) => {
    holder.cookie = "not-the-token";
    const shown = await html(await page());
    for (const part of [adminCopy.pin.label, adminCopy.pin.unlock]) expect(shown).toContain(part);
    // The nav and its Log out belong to the unlocked page.
    expect(shown).not.toContain(adminCopy.nav.logout);
    expect(openDb).not.toHaveBeenCalled();
  });

  it("/admin/runs/<unknown id> does not call notFound", async () => {
    await expect(run("999999")).resolves.toMatchObject({ type: AdminShell });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("/admin pages, unlocked", () => {
  // Opening PGlite and migrating takes seconds and more under load: do it in a hook (hookTimeout),
  // not inside the test (testTimeout 10 s), as the route tests do (08zk).
  let db: Db;
  beforeAll(async () => {
    db = await openTestDb();
  });

  // The session check reads the clock itself: it runs at T0, the context's clock.
  afterEach(() => vi.useRealTimers());

  /** Signed in at T0, with amber: no member role yet, made a week before. */
  async function signedInWithAmber() {
    vi.useFakeTimers({ toFake: ["Date"], now: T0 });
    await truncateAll(db);
    holder.ctx = testContext(db).ctx;
    holder.cookie = adminToken(TEST_ENV, T0);
    await db.insert(workspaces).values({
      unionId: 101,
      slug: "amber",
      discordGuildId: "700000000000000101",
      leaderRoleIds: ["700000000000000201"],
      createdAt: new Date(T0.getTime() - 7 * 86_400_000),
    });
  }

  it("/admin's Activity shows each workspace's setup steps when PostHog has no totals (F12)", async () => {
    await signedInWithAmber();
    const shown = await html(await AdminPage());
    const activity = shown.slice(shown.indexOf(">Activity</h2>"));
    expect(shown).toContain(">Activity</h2>");
    expect(activity).toContain("No totals from PostHog right now: setup steps only.");
    for (const step of ['href="#w-amber"', "Created", "Member role", "First read", "not yet"])
      expect(activity).toContain(step);
  });

  it("/admin opens with what needs the owner, before Status, and the nav counts the last day's app errors (issue 585)", async () => {
    await signedInWithAmber();
    // One page error under amber's address 3 h ago; one request waiting.
    await db.insert(appErrors).values({
      at: new Date(T0.getTime() - 3 * 3_600_000),
      route: "/w/[slug]/roll-call",
      digest: "d1a2",
      message: "roll_call_conflict",
      workspaceSlug: "amber",
    });
    await db.insert(accessRequests).values({
      unionId: 910103,
      playerName: "Juniper Vale",
      claimedRole: "r4",
      rosterMatch: "found",
      statusHash: "hash-1",
      createdAt: T0,
    });

    const shown = await html(await AdminPage());
    const needs = shown.indexOf(">Needs you</h2>");
    expect(needs).toBeGreaterThan(0);
    expect(shown.indexOf(">Status</h2>")).toBeGreaterThan(needs);
    const section = shown.slice(needs, shown.indexOf(">Status</h2>"));
    for (const row of ["Access requests", "1 waiting", "1 in the last 24 h", "1 to set up"])
      expect(section).toContain(row);
    expect(section).toContain('href="/admin/errors"');
    // The nav's App errors count, read out in words.
    expect(shown).toContain(", 1 in the last 24 h");
    // The Alliances row's page errors open that workspace's errors, not its settings (F34).
    expect(shown).toContain('href="/admin/errors?w=amber"');
  });

  it("/admin/runs/<unknown id> still calls notFound", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: T0 });
    holder.ctx = testContext(db).ctx;
    holder.cookie = adminToken(TEST_ENV, T0);
    await expect(run("999999")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
