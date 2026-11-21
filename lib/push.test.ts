// Who gets an officers' notification (D148) against a real Postgres (PGlite) and a push service stub: only the
// workspace's officers with a session that has not ended, not blocked, on a device turned on for that use;
// never a member, nor another workspace's officer. A device the push service says is gone is deleted.
// Without the site's push keys nothing is read or sent. Invented names; no real push service.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { notifyOfficers } from "./push";
import {
  browserDevice,
  PUSH_ENV,
  pushService,
  saveTestDevice,
  sessionFor,
  type Device,
} from "./push.test-helpers";
import { workspaces, workspaceUsers } from "./schema";
import { pushSubscriptions } from "./schema-push";

const NOW = new Date("2026-11-21T12:00:00Z");
const notice = () => ({
  title: "Raid Shield check",
  body: "3 not seen",
  url: "/w/alpha",
  tag: "t",
});

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** A workspace and a person in it with a session of `tier` that ends at `ends`. */
async function person(slug: string, tier: "officer" | "member", ends = 7, blocked = false) {
  let [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
  if (!ws) {
    const unionId = slug === "alpha" ? 900_001 : 900_002;
    [ws] = await db
      .insert(workspaces)
      .values({ unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
      .returning();
  }
  const workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `${slug}-${Math.random()}`, blocked })
    .returning({ id: workspaceUsers.id });
  const userId = user?.id ?? 0;
  const signedIn = new Date(NOW.getTime() - (7 - ends) * 86_400_000);
  await sessionFor(db, { workspaceId, userId }, signedIn, tier);
  return { workspaceId, userId };
}

describe("notifyOfficers (D148)", () => {
  beforeEach(() => truncateAll(db));

  it("reaches only the workspace's officers whose sign-in has not ended, on devices on for that use", async () => {
    const devices: Record<string, Device> = {};
    const add = async (name: string, who: { workspaceId: number; userId: number }, on = true) => {
      devices[name] = browserDevice(name);
      await saveTestDevice(db, {
        ...who,
        device: devices[name],
        uses: on ? ["shield"] : ["claim"],
      });
    };
    const officer = await person("alpha", "officer");
    await add("officer", officer);
    await add("useOff", await person("alpha", "officer"), false);
    await add("member", await person("alpha", "member"));
    await add("ended", await person("alpha", "officer", 0));
    await add("blocked", await person("alpha", "officer", 7, true));
    await add("bravo", await person("bravo", "officer"));
    const push = pushService();
    const deps = { env: PUSH_ENV, fetch: push.fetch, now: () => NOW };
    const counts = await notifyOfficers(deps, db, officer.workspaceId, "shield", notice);
    expect(counts).toEqual({ sent: 1, gone: 0, failed: 0 });
    expect(push.pushes.map((p) => p.endpoint)).toEqual([devices.officer?.sub.endpoint]);
    expect(push.received(devices.officer as Device)).toEqual([notice()]);
  });

  it("deletes a device the push service says is gone (404, 410), keeps one that failed, stamps one delivered", async () => {
    const officer = await person("alpha", "officer");
    const [ok, gone404, gone410, failed] = ["ok", "g404", "g410", "fail"].map(browserDevice);
    for (const device of [ok, gone404, gone410, failed] as Device[])
      await saveTestDevice(db, { ...officer, device, uses: ["shield"] });
    const status = (e: string) => (e.includes("g404") ? 404 : e.includes("g410") ? 410 : 0);
    const push = pushService((e) => status(e) || (e.includes("fail") ? 500 : 201));
    const deps = { env: PUSH_ENV, fetch: push.fetch, now: () => NOW };
    const counts = await notifyOfficers(deps, db, officer.workspaceId, "shield", notice);
    expect(counts).toEqual({ sent: 1, gone: 2, failed: 1 });
    const left = await db
      .select({ hash: pushSubscriptions.endpointHash, at: pushSubscriptions.lastSuccessAt })
      .from(pushSubscriptions);
    expect(left).toHaveLength(2);
    expect(left.filter((r) => r.at !== null).map((r) => r.at)).toEqual([NOW]);
  });

  it("reads and sends nothing without the site's push keys", async () => {
    const officer = await person("alpha", "officer");
    await saveTestDevice(db, { ...officer, device: browserDevice("x"), uses: ["shield"] });
    const fetch = vi.fn<typeof globalThis.fetch>();
    const deps = { env: TEST_ENV, fetch, now: () => NOW };
    const counts = await notifyOfficers(deps, db, officer.workspaceId, "shield", notice);
    expect(counts).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
