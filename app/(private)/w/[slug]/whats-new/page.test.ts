// Issue 782: What's new is the officers' page; a member or an officer of another workspace never opens it,
// and their visit marks nothing seen.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { featuresBySlug } from "@/lib/private/features";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { whatsNew } from "@/lib/private/whats-new";
import { workspaces, workspaceUsers } from "@/lib/schema";

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

const { default: WhatsNewPage } = await import("./page");
const params = Promise.resolve({ slug: "ogs" });

/** Where the page sent the visitor: "→ /path", or "rendered". */
async function outcome(): Promise<string> {
  try {
    await WhatsNewPage({ params });
    return "rendered";
  } catch (e) {
    const digest = String((e as { digest?: unknown }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return `→ ${digest.split(";")[2]}`;
    throw e;
  }
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
// The page reads the clock itself: it runs at T0, the context's clock.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: T0 });
  await truncateAll(db);
  await db.insert(workspaces).values([
    {
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    },
    { unionId: 67109944, slug: "nse", discordGuildId: "4", leaderRoleIds: ["5"] },
  ]);
  holder.ctx = testContext(db).ctx;
});
afterEach(() => vi.useRealTimers());

async function signIn(workspaceId: number, tier: "officer" | "member") {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `id-${workspaceId}-${tier}`, displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  holder.token = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, tier)).token;
}

const seen = async () => (await db.select().from(workspaceUsers)).map((u) => u.whatsNewSeen);

describe("What's new is the officers' page (issue 782)", () => {
  it("renders for the workspace's own officer and marks the newest release it can see as seen", async () => {
    await signIn(1, "officer");
    expect(await outcome()).toBe("rendered");
    const features = await featuresBySlug(db, "ogs");
    const newest = features && whatsNew({ features }, "en")[0]?.version;
    expect(newest).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(await seen()).toEqual([newest]);
  });

  it("sends a member to the board and marks nothing seen", async () => {
    await signIn(1, "member");
    expect(await outcome()).toBe("→ /w/ogs/board");
    expect(await seen()).toEqual([null]);
  });

  it("sends another workspace's officer to the sign-in and marks nothing seen", async () => {
    await signIn(2, "officer");
    expect(await outcome()).toBe("→ /w/ogs?next=%2Fw%2Fogs%2Fwhats-new");
    expect(await seen()).toEqual([null]);
  });
});
