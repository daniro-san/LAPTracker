import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { createRepo } from "@/lib/repo";
import { findOrCreateEvent } from "@/lib/repo/events";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const STORED = {
  1: "https://phs-image.globallap.com/ASTC6_1.jpg",
  2: "https://evil.example/ASTC6_2.jpg",
  3: "https://phs-image.globallap.com.evil.example/ASTC6_3.jpg",
  4: "http://phs-image.globallap.com/ASTC6_4.jpg",
  5: "https://phs-image.globallap.com:8443/ASTC6_5.jpg",
} as const;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
}, 30_000);

describe("GET /img/avatar/[uid]", () => {
  it("fetches a stored photo only from phs-image.globallap.com over plain https", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
    );
    holder.ctx = { ...testContext(db).ctx, fetch };
    const repo = createRepo(db);
    const { id: eventId } = await findOrCreateEvent(db, {
      name: "Saturday Event 2026-11-07",
      eventAtUtc: T0,
      beforeAt: T0,
      afterAt: T0,
    });
    const snapshotId = (await repo.startSnapshot(eventId, "before", T0, null)) ?? 0;
    const members = Object.entries(STORED).map(([uid, avatarUrl]) => ({
      uid: Number(uid),
      name: `p${uid}`,
      power: 1,
      kills: 1,
      lv: 1,
      avatarUrl,
    }));
    await repo.insertAllianceRow(
      snapshotId,
      {
        unionId: 67111155,
        tag: "OGs",
        name: "OldGrandmas",
        memberCount: members.length,
        totalPower: 5,
        totalKills: 5,
        serverRank: 2,
        level: 8,
        badgeId: 110,
        sourceUpdatedAt: T0,
        cached: false,
        powerBoard: null,
        killsBoard: null,
        source: "v1",
        isFresh: true,
        error: null,
        raw: null,
      },
      members,
    );
    const get = (uid: number) =>
      GET(request(`/img/avatar/${uid}`, { method: "GET" }), {
        params: Promise.resolve({ uid: String(uid) }),
      });

    const ok = await get(1);
    expect(ok.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe(STORED[1]);

    for (const uid of [2, 3, 4, 5]) {
      const res = await get(uid);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
