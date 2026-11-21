// POST /api/w/[slug]/push (D148): an officer turns notifications on for their own device (stored sealed), changes
// its uses and turns it off; another workspace's officer reaches none of it (issue 471); without the site's
// push keys there is no card and nothing is stored; only a browser's push service is accepted as endpoint; and
// signing out on the device turns it off. Invented names; no push is sent.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { pushView } from "@/lib/private/push-settings";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { endpointHash } from "@/lib/push";
import { browserDevice, PUSH_ENV } from "@/lib/push.test-helpers";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { pushSubscriptions } from "@/lib/schema-push";
import { ownedRows } from "@/lib/workspace-data.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");
const logout = await import("../logout/route");

const ORIGIN = "https://laptracker.test";
let db: Db;
const token = { alpha: "", bravo: "" };
const ids = { alpha: { id: 0, unionId: 900_001 }, bravo: { id: 0, unionId: 900_002 } };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db, PUSH_ENV).ctx;
  for (const slug of ["alpha", "bravo"] as const) {
    const unionId = ids[slug].unionId;
    const [ws] = await db
      .insert(workspaces)
      .values({ unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
      .returning({ id: workspaces.id });
    ids[slug].id = ws?.id ?? 0;
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ids[slug].id, discordUserId: `${slug}-1`, displayName: "Ana" })
      .returning({ id: workspaceUsers.id });
    const made = await createSession(db, ids[slug].id, user?.id ?? 0, T0, null, "officer");
    token[slug] = made.token;
  }
});

const ask = (path: string, body: unknown, as: keyof typeof token = "alpha") =>
  new Request(`${ORIGIN}/api/w/${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${token[as]}`,
    },
    body: JSON.stringify(body),
  });
const post = (slug: string, body: unknown, as: keyof typeof token = "alpha") =>
  route.POST(ask(`${slug}/push`, body, as), { params: Promise.resolve({ slug }) });

const rows = () => db.select().from(pushSubscriptions);
const turnOn = (slug: string, device: ReturnType<typeof browserDevice>, as = slug) =>
  post(
    slug,
    {
      action: "subscribe",
      subscription: device.sub,
      uses: ["shield", "roll_call"],
      language: "fr",
    },
    as as keyof typeof token,
  );

describe("POST /api/w/[slug]/push (D148)", () => {
  it("saves the officer's device sealed, changes its uses, and turns it off", async () => {
    const device = browserDevice("phone");
    expect((await turnOn("alpha", device)).status).toBe(200);
    const [row] = await rows();
    expect(row?.endpointHash).toBe(endpointHash(device.sub.endpoint));
    // The Raid Shield check is off for a new alliance (D134), so its use is not stored.
    expect([row?.uses, row?.language]).toEqual([["roll_call"], "fr"]);
    expect(JSON.stringify(row)).not.toContain(device.sub.endpoint);
    expect(JSON.stringify(row)).not.toContain(device.sub.keys.auth);
    const endpoint = device.sub.endpoint;
    const uses = { action: "uses", endpoint, uses: ["claim"], language: "en" };
    expect((await post("alpha", uses)).status).toBe(200);
    expect((await rows())[0]?.uses).toEqual(["claim"]);
    expect((await post("alpha", { action: "unsubscribe", endpoint })).status).toBe(200);
    expect(await rows()).toEqual([]);
  });

  it("issue 471: Alpha's officer changes and deletes nothing of Bravo's, and is signed out at Bravo's address", async () => {
    const device = browserDevice("bravo-phone");
    expect((await turnOn("bravo", device)).status).toBe(200);
    const before = await ownedRows(db, ids.bravo);
    const { endpoint } = device.sub;
    const uses = { action: "uses", endpoint, uses: ["claim"], language: "en" };
    expect((await post("alpha", uses)).status).toBe(404);
    expect((await post("alpha", { action: "unsubscribe", endpoint })).status).toBe(200);
    expect((await post("bravo", { action: "unsubscribe", endpoint }, "alpha")).status).toBe(401);
    expect((await turnOn("bravo", browserDevice("x"), "alpha")).status).toBe(401);
    expect(await ownedRows(db, ids.bravo)).toEqual(before);
  });

  it("without the site's push keys: no card, and nothing is stored", async () => {
    holder.ctx = testContext(db, TEST_ENV).ctx;
    expect((await turnOn("alpha", browserDevice("phone"))).status).toBe(403);
    expect(await rows()).toEqual([]);
    const access = await requireWorkspace(db, "alpha", { get: () => ({ value: token.alpha }) }, T0);
    if (!access.ok) throw new Error("no access");
    expect(await pushView(db, access, TEST_ENV)).toBeNull();
  });

  it("refuses an endpoint that is not a browser's push service", async () => {
    const device = browserDevice("phone");
    const sub = { ...device.sub, endpoint: "https://169.254.169.254/latest/meta-data" };
    const body = { action: "subscribe", subscription: sub, uses: ["shield"], language: "en" };
    expect((await post("alpha", body)).status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("signing out with the device's endpoint turns its notifications off", async () => {
    const device = browserDevice("phone");
    await turnOn("alpha", device);
    const out = await logout.POST(ask("alpha/logout", { endpoint: device.sub.endpoint }), {
      params: Promise.resolve({ slug: "alpha" }),
    });
    expect(out.status).toBe(200);
    const left = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.workspaceId, ids.alpha.id));
    expect(left).toEqual([]);
  });
});
