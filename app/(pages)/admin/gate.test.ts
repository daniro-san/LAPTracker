// Issue 218: every /admin page checks the session before it reads the database.
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { adminToken } from "@/lib/admin-session";
import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { openTestDb } from "@/lib/db.test-helpers";
import type { Env } from "@/lib/env";

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
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const { default: AdminPage } = await import("./page");
const { default: RunsPage } = await import("./runs/page");
const { default: ErrorsPage } = await import("./errors/page");
const { default: RunPage } = await import("./runs/[id]/page");

const run = (id: string) => RunPage({ params: Promise.resolve({ id }) });
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
    ["/admin/errors", () => ErrorsPage()],
    ["/admin/runs/1", () => run("1")],
  ])("%s renders the shell with no children and opens no database connection", async (_, page) => {
    holder.cookie = "not-the-token";
    const el = await page();
    expect(el.type).toBe(AdminShell);
    expect((el.props as { children?: unknown }).children).toBeUndefined();
    await AdminShell(el.props as { title: string });
    expect(openDb).not.toHaveBeenCalled();
  });

  it("/admin/runs/<unknown id> does not call notFound", async () => {
    await expect(run("999999")).resolves.toMatchObject({ type: AdminShell });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("/admin pages, unlocked", () => {
  it("/admin/runs/<unknown id> still calls notFound", async () => {
    holder.ctx = testContext(await openTestDb()).ctx;
    holder.cookie = adminToken(TEST_ENV);
    await expect(run("999999")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
