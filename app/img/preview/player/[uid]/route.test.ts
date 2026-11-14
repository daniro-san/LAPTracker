import { ImageResponse } from "next/og";
import { createElement } from "react";
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

const PHOTO = "https://phs-image.globallap.com/ASTC6_1.jpg";
const square = (px: number) =>
  new ImageResponse(
    createElement("div", { style: { display: "flex", width: px, height: px, background: "red" } }),
    { width: px, height: px },
  ).arrayBuffer();

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  const repo = createRepo(db);
  const { id: eventId } = await findOrCreateEvent(db, {
    name: "Saturday Event 2026-11-07",
    eventAtUtc: T0,
    beforeAt: T0,
    afterAt: T0,
  });
  const snapshotId = (await repo.startSnapshot(eventId, "before", T0, null)) ?? 0;
  const member = (uid: number, frameId: number | null) =>
    ({ uid, name: `p${uid}`, power: 1, kills: 1, lv: 1, avatarUrl: PHOTO, frameId }) as const;
  await repo.insertAllianceRow(
    snapshotId,
    {
      unionId: 67111155,
      tag: "OGs",
      name: "OldGrandmas",
      memberCount: 2,
      totalPower: 2,
      totalKills: 2,
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
    [member(1, 5010), member(2, null)],
  );
});

const get = (uid: number) =>
  GET(request(`/img/preview/player/${uid}`, { method: "GET" }), {
    params: Promise.resolve({ uid: String(uid) }),
  });

describe("GET /img/preview/player/[uid]", () => {
  it("draws the photo inside the player's frame as one 380 × 380 PNG, and serves the photo alone without a frame (D65)", async () => {
    const [photo, frame] = await Promise.all([square(180), square(190)]);
    const fetch = vi.fn<typeof globalThis.fetch>(
      async (url) =>
        new Response(String(url).includes("/frames/") ? frame : photo, {
          headers: { "content-type": "image/png" },
        }),
    );
    holder.ctx = { ...testContext(db).ctx, fetch };

    const withFrame = await get(1);
    const png = new DataView(await withFrame.arrayBuffer());
    // IHDR: width and height are the big-endian words at bytes 16 and 20.
    expect([png.getUint32(16), png.getUint32(20)]).toEqual([380, 380]);
    expect(fetch.mock.calls.map((c) => String(c[0]))).toEqual([
      PHOTO,
      "https://site.test/static/frames/frame_5010.png",
    ]);

    const alone = await get(2);
    expect(alone.status).toBe(200);
    expect((await alone.arrayBuffer()).byteLength).toBe(photo.byteLength);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
