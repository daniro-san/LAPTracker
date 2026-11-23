// D126 amended (issue 483): a page turned off for the alliance is simply not there. An officer opening its
// address goes to the desk's Home with no message; a member opening the turned-off board gets the standard
// not-found page.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null, token: "" }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof import("@/lib/env")>()),
  getEnv: () => TEST_ENV,
}));
// withPageDb closes the request's connection in `after` (D141, 2026-11-21), which needs a Next request.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { value: holder.token } : undefined),
  }),
  headers: async () => new Headers(),
}));

const { default: TheftsPage } = await import("./thefts/page");
const { default: RollCallPage } = await import("./roll-call/page");
const { default: CaravansPage } = await import("./calendar/caravans/page");
const { default: NoticesPage } = await import("./notices/page");
const { default: StartHerePage } = await import("./start-here/page");
const { default: BoardPage } = await import("./board/page");
const { default: InsightsPage } = await import("./insights/page");

const params = Promise.resolve({ slug: "ogs" });
const searchParams = Promise.resolve({});

/** Where the page sent the visitor: "→ /path", "404", or "rendered". */
async function outcome(page: () => Promise<unknown>): Promise<string> {
  try {
    await page();
    return "rendered";
  } catch (e) {
    const digest = String((e as { digest?: unknown }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return `→ ${digest.split(";")[2]}`;
    if (digest.endsWith(";404")) return "404";
    throw e;
  }
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
// The pages read the clock themselves: they run at T0, the context's clock.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: T0 });
  await truncateAll(db);
  await db.insert(workspaces).values({
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  holder.ctx = testContext(db).ctx;
});

afterEach(() => vi.useRealTimers());

async function signIn(tier: "officer" | "member") {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: `id-${tier}`, displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  holder.token = (await createSession(db, 1, user?.id ?? 0, T0, null, tier)).token;
}

const turnOff = (switches: Record<string, boolean>) =>
  db.insert(workspaceFeatures).values({ workspaceId: 1, switches });

describe("a page turned off for the alliance (D126, issue 483)", () => {
  it("sends an officer to Home, with no page of its own", async () => {
    await signIn("officer");
    await turnOff({
      thefts: false,
      roll_call: false,
      caravans: false,
      notices: false,
      board: false,
      insights: false,
    });
    const pages = [
      () => TheftsPage({ params }),
      () => RollCallPage({ params, searchParams }),
      () => CaravansPage({ params, searchParams }),
      () => NoticesPage({ params, searchParams }),
      () => StartHerePage({ params }),
      () => BoardPage({ params }),
      () => InsightsPage({ params, searchParams }),
    ];
    for (const page of pages) expect(await outcome(page)).toBe("→ /w/ogs");
  });

  it("gives a member the standard not-found page for the turned-off board", async () => {
    await signIn("member");
    await turnOff({ board: false });
    expect(await outcome(() => BoardPage({ params }))).toBe("404");
  });
});
