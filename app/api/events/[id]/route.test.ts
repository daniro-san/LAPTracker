import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { BLOCKED_ROSTER_KEYS, findBlockedKeys } from "@/lib/queries";
import { createRepo } from "@/lib/repo";
import { findOrCreateEvent } from "@/lib/repo/events";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const roster = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "../../../../fixtures/v1-20261104T155902Z/alliance-67111155.json"),
    "utf8",
  ),
) as { union_id: number; power: number; members: { uid: number; nick_name: string }[] };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

describe("GET /api/events/[id]", () => {
  const get = (eventId: number) =>
    GET(request(`/api/events/${eventId}`, { method: "GET" }), {
      params: Promise.resolve({ id: String(eventId) }),
    });

  let seeded: Promise<number> | undefined;
  const seedEvent = () => (seeded ??= seed());
  async function seed() {
    holder.ctx = testContext(db).ctx;
    const repo = createRepo(db);
    const { id: eventId } = await findOrCreateEvent(db, {
      name: "Saturday Event 2026-11-07",
      eventAtUtc: T0,
      beforeAt: T0,
      afterAt: T0,
    });
    const snapshotId = (await repo.startSnapshot(eventId, "before", T0, null)) ?? 0;
    const members = roster.members.map((m) => ({
      uid: m.uid,
      name: m.nick_name,
      power: 1,
      kills: 1,
      lv: 1,
    }));
    await repo.insertAllianceRow(
      snapshotId,
      {
        unionId: roster.union_id,
        tag: "OGs",
        name: "OldGrandmas",
        memberCount: members.length,
        totalPower: roster.power,
        totalKills: 1,
        serverRank: 2,
        level: 10,
        badgeId: null,
        powerBoard: null,
        killsBoard: null,
        source: "v1",
        sourceUpdatedAt: T0,
        cached: false,
        isFresh: true,
        error: null,
        raw: roster,
      },
      members,
    );
    // Not vacuous: what is stored carries every blocked key.
    const stored = new Set(findBlockedKeys(roster).map((p) => p.split(".").at(-1)));
    expect([...BLOCKED_ROSTER_KEYS].every((k) => stored.has(k))).toBe(true);

    return eventId;
  }

  it("serves an event with a stored roster and none of BLOCKED_ROSTER_KEYS", async () => {
    const res = await get(await seedEvent());

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(JSON.stringify(body)).toContain(String(roster.power));
    expect(findBlockedKeys(body)).toEqual([]);
  });

  it("drops run bookkeeping, isTest and the board numbers", async () => {
    const body = (await (await get(await seedEvent())).json()) as {
      event: { snapshots: { alliances: object[] }[] };
    };

    const served = JSON.stringify(body);
    for (const key of [
      "callsUsed",
      "quotaRemainingAfter",
      "durationMs",
      "boardPulledAt",
      "isTest",
      "powerBoard",
      "killsBoard",
      "source",
      "cached",
    ])
      expect(served).not.toContain(`"${key}":`);
    expect(served).not.toContain('"error":');
    expect(body.event.snapshots[0]?.alliances).toHaveLength(1);
  });

  it("serves a two-window event's Start and End only, never its rows between windows (D160)", async () => {
    holder.ctx = testContext(db).ctx;
    const repo = createRepo(db);
    const at = (h: string) => new Date(`2026-12-05T${h}:00Z`);
    const w1 = { beforeAt: at("02:00"), afterAt: at("02:45") };
    const w2 = { beforeAt: at("14:15"), afterAt: at("15:15") };
    const { id } = await findOrCreateEvent(db, {
      name: "Origin of Chaos 2026-12-05",
      eventAtUtc: at("02:10"),
      beforeAt: w1.beforeAt,
      afterAt: w2.afterAt,
      windows: [w1, w2],
    });
    for (const [phase, window] of [
      ["before", 1],
      ["after", 1],
      ["before", 2],
      ["after", 2],
    ] as const) {
      const snapshotId = (await repo.startSnapshot(id, phase, T0, null, window)) ?? 0;
      await repo.insertAllianceRow(
        snapshotId,
        {
          unionId: roster.union_id,
          tag: "OGs",
          name: "OldGrandmas",
          memberCount: 0,
          totalPower: 1,
          totalKills: 1,
          serverRank: 2,
          level: 10,
          badgeId: null,
          powerBoard: 7,
          killsBoard: 7,
          source: "v1",
          sourceUpdatedAt: T0,
          cached: false,
          isFresh: true,
          error: null,
          raw: null,
        },
        [],
      );
    }

    const body = (await (await get(id)).json()) as { event: Record<string, unknown> };

    expect(body.event).not.toHaveProperty("between");
    expect((body.event.snapshots as unknown[]).length).toBe(2);
    const served = JSON.stringify(body);
    for (const key of ["powerBoard", "killsBoard", "source", "cached"])
      expect(served).not.toContain(`"${key}":`);
  });

  it("sends a 5-minute shared cache header on 200 only", async () => {
    const ok = await get(await seedEvent());
    const missing = await get(999_999);

    expect(ok.headers.get("Cache-Control")).toBe("public, s-maxage=300");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control") ?? "").not.toContain("s-maxage");
  });
});
