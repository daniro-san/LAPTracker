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
}, 30_000);

describe("GET /api/events/[id]", () => {
  it("serves an event with a stored roster and none of BLOCKED_ROSTER_KEYS", async () => {
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

    const res = await GET(request(`/api/events/${eventId}`, { method: "GET" }), {
      params: Promise.resolve({ id: String(eventId) }),
    });

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(JSON.stringify(body)).toContain(String(roster.power));
    expect(findBlockedKeys(body)).toEqual([]);
  });
});
