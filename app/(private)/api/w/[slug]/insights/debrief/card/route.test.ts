// GET /api/w/[slug]/insights/debrief/card (issue 872): 403 turned_off with Insights off, 404 with no debrief,
// a PNG to save (private, no-store, the KvK's day in the file name), and 429 past the hourly renders. The
// session refusals are in member-session.test.ts. Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import type { WorkspaceAccess } from "@/lib/private/access";
import { CARD_RENDERS, cardRenderAllowed } from "@/lib/private/kvk-debrief";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import {
  allianceSnapshots,
  events,
  memberSnapshots,
  snapshots,
  workspaces,
  workspaceUsers,
} from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const UNION = 67109944;
/** Saturday 2026-11-07, 12:00 ST (UTC−2): a KvK. */
const AT = new Date("2026-11-07T14:00:00Z");
const NOW = new Date("2026-11-08T12:00:00Z");
let db: Db;
let workspaceId = 0;
let officer = "";

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db);
  test.clock.now = NOW;
  holder.ctx = test.ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: UNION, slug: "nse", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "u-1", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, workspaceId, user?.id ?? 0, NOW, null, "officer")).token;
});

/** A KvK with a Start and an End of the alliance; one member gained 30 kills. */
async function kvk() {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event",
      eventAtUtc: AT,
      allianceIds: [UNION],
      beforeAt: new Date(AT.getTime() - 3_600_000),
      afterAt: new Date(AT.getTime() + 3_600_000),
    })
    .returning({ id: events.id });
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt: AT, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: snap?.id ?? 0, unionId: UNION, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values({
      allianceSnapshotId: row?.id ?? 0,
      uid: 1,
      name: "Invented One",
      kills: 100 + i * 30,
    });
  }
}

const get = () =>
  route.GET(
    new Request(`${ORIGIN}/api/w/nse/insights/debrief/card`, {
      headers: { cookie: `${SESSION_COOKIE}=${officer}` },
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

describe("GET /api/w/[slug]/insights/debrief/card (issue 872)", () => {
  it("is turned off with the alliance's Insights (403 turned_off)", async () => {
    await kvk();
    await db.insert(workspaceFeatures).values({ workspaceId, switches: { insights: false } });
    const res = await get();
    expect([res.status, await res.json()]).toEqual([403, { code: "turned_off" }]);
  });

  it("answers 404 with no KvK debrief", async () => {
    const res = await get();
    expect([res.status, await res.json()]).toEqual([404, { code: "not_found" }]);
  });

  it("sends the card as a PNG file, never cached", { timeout: 40_000 }, async () => {
    await kvk();
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="kvk-debrief-2026-11-07.png"',
    );
    const png = new Uint8Array(await res.arrayBuffer());
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("refuses a render past the hour's limit (429 rate_limited)", async () => {
    await kvk();
    const access = { workspaceId } as WorkspaceAccess;
    for (let i = 0; i < CARD_RENDERS; i++) await cardRenderAllowed(db, access, NOW);
    const res = await get();
    expect([res.status, await res.json()]).toEqual([429, { code: "rate_limited" }]);
  });
});
