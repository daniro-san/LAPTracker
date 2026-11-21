// INVARIANT cache.write-invalidates-reads (D143): a manual round's create, rename and settings, and a run,
// drop the public pages' shared reads, so the first view after the write reads the new rows.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { listEvents } from "@/lib/queries";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const manualRoute = await import("./route");
const settingsRoute = await import("./settings/route");
const renameRoute = await import("./rename/route");
const snapshotRoute = await import("../snapshot/route");

const post = (route: { POST: (r: Request) => Promise<Response> }, path: string, body?: unknown) =>
  route.POST(
    new Request(`https://laptracker.test${path}`, {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": TEST_PIN },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
  );

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** A context whose shared reads are counted, and a read of the event list through them. */
function counted() {
  const { ctx } = testContext(db);
  holder.ctx = ctx;
  const invalidate = vi.spyOn(ctx.publicCache, "invalidate");
  const shownEvents = () => ctx.publicCache.read("events", [], () => listEvents(db));
  return { invalidate, shownEvents };
}

const roundId = async (res: Response) => ((await res.json()) as { event_id: number }).event_id;

describe("the public pages' shared reads after a manual round's writes (D143)", () => {
  it("shows a created round on the first view after the create", async () => {
    const { invalidate, shownEvents } = counted();
    expect(await shownEvents()).toEqual([]);

    expect((await post(manualRoute, "/api/manual-event", { name: "Dry run" })).status).toBe(201);

    expect(invalidate).toHaveBeenCalledOnce();
    expect((await shownEvents()).map((e) => e.name)).toEqual(["Dry run"]);
  });

  it("drops them on a run, once its row is final", async () => {
    const { invalidate } = counted();
    const id = await roundId(await post(manualRoute, "/api/manual-event"));
    invalidate.mockClear();

    expect((await post(snapshotRoute, `/api/snapshot?event=${id}&phase=before`)).status).toBe(200);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("drops them on a rename", async () => {
    const { invalidate, shownEvents } = counted();
    const id = await roundId(await post(manualRoute, "/api/manual-event", { name: "Dry run" }));
    await post(snapshotRoute, `/api/snapshot?event=${id}&phase=before`);
    expect((await shownEvents()).map((e) => e.name)).toEqual(["Dry run"]);
    invalidate.mockClear();

    const res = await post(renameRoute, "/api/manual-event/rename", { event_id: id, name: "KvK" });

    expect(res.status).toBe(200);
    expect(invalidate).toHaveBeenCalledOnce();
    expect((await shownEvents()).map((e) => e.name)).toEqual(["KvK"]);
  });

  it("drops them when a round's visibility changes", async () => {
    const { invalidate, shownEvents } = counted();
    const id = await roundId(await post(manualRoute, "/api/manual-event", { name: "Dry run" }));
    expect(await shownEvents()).toHaveLength(1);
    invalidate.mockClear();

    const res = await post(settingsRoute, "/api/manual-event/settings", {
      event_id: id,
      visibility: "admin",
    });

    expect(res.status).toBe(200);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(await shownEvents()).toEqual([]);
  });
});
