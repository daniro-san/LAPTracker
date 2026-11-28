// D123 phase 2: deleting one follow-up record from a member's history, on the shared soft delete. A deleted
// record leaves the card's history, Follow-up's count, Home and the download's main file; Undo is the
// deleter's own within UNDO_MS, and is refused once Follow-up's own Undo withdrew a record after the delete.
// Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { recentActivity } from "@/lib/private/desk-activity.test-helpers";
import { followUpCounts, followUpsOf } from "@/lib/private/follow-up";
import { membersView } from "@/lib/private/members";
import { UNDO_MS } from "@/lib/private/roll-call";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import {
  dailyReads,
  dailyRosters,
  memberFollowUps,
  workspaces,
  workspaceUsers,
} from "@/lib/schema";
import { unzip } from "@/lib/zip.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");
const exportRoute = await import("../data-export/route");

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
let db: Db;
const tokens: Record<string, string> = {};
let clock: { now: Date };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const context = testContext(db);
  holder.ctx = context.ctx;
  clock = context.clock;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [other] = await db
    .insert(workspaces)
    .values({ unionId: 1, slug: "rivals", discordGuildId: "9", leaderRoleIds: ["8"] })
    .returning({ id: workspaces.id });
  // An end-of-day read, so the members view (and Follow-up's count) is not the early one.
  const readAt = new Date("2026-11-06T23:37:00-02:00");
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: readAt, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 1,
    isFresh: true,
    sourceUpdatedAt: readAt,
    memberUids: [101],
    memberNames: ["Bramble"],
    memberPower: [1000],
    memberKills: [0],
    rawJson: {
      members: [
        {
          uid: 101,
          nick_name: "Bramble",
          power: 1000,
          lv: 25,
          rank_code: 103,
          rank_label: "R3",
          daily_tech: null,
          active: 0,
        },
      ],
    },
  });
  // Mo has a member's session (D105); Zed is an officer of another workspace.
  for (const [name, wsId, tier] of [
    ["Ana", ws?.id, "officer"],
    ["Bo", ws?.id, "officer"],
    ["Mo", ws?.id, "member"],
    ["Zed", other?.id, "officer"],
  ] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: wsId ?? 0, discordUserId: `ws-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    tokens[name] = (await createSession(db, wsId ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

const request = (path: string, body: unknown, who: string) => {
  const slug = who === "Zed" ? "rivals" : "ogs";
  return new Request(`https://laptracker.test/api/w/${slug}/${path}`, {
    method: "POST",
    headers: {
      origin: "https://laptracker.test",
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${tokens[who]}`,
    },
    body: JSON.stringify(body),
  });
};
const post = async (body: unknown, who = "Ana") => {
  const slug = who === "Zed" ? "rivals" : "ogs";
  const res = await route.POST(request("follow-up", body, who), {
    params: Promise.resolve({ slug }),
  });
  return res.status;
};

/** Ana records a follow-up about Bramble: its id and request id. */
async function record(action = "talked") {
  const requestId = randomUUID();
  await post({ uid: 101, action, note: "", until: null, version: 0, requestId });
  const rows = await db.select({ id: memberFollowUps.id }).from(memberFollowUps);
  return { id: Math.max(...rows.map((r) => r.id)), requestId };
}
const remove = (id: number, requestId: string, undo?: true) => ({
  uid: 101,
  action: "delete",
  id,
  requestId,
  ...(undo && { undo }),
});

const access = async (who = "Ana") => {
  const a = await requireWorkspace(db, "ogs", { get: () => ({ value: tokens[who] ?? "" }) }, T0);
  if (!a.ok) throw new Error("no access");
  return a;
};
/** The member card's history: Bramble's records still counting. */
const history = async () => (await followUpsOf(db, await access(), 101)).length;

describe("deleting a follow-up record from a member's history (D123 phase 2)", () => {
  it("leaves the card's history, Follow-up's count, Home and the download's main file", async () => {
    const { id, requestId } = await record();
    const a = await access();
    const noted = async () =>
      (await followUpCounts(db, a, await membersView(db, a, T0, ZONE), T0, ZONE))?.noted;
    expect([await history(), await noted()]).toEqual([1, 1]);
    expect(await post(remove(id, randomUUID()), "Bo")).toBe(200);
    expect([await history(), await noted()]).toEqual([0, 0]);
    const kinds = (await recentActivity(db, a, T0)).map((l) => l.item.kind);
    expect([kinds.includes("followUpDeleted"), kinds.includes("followUp")]).toEqual([true, false]);
    const res = await exportRoute.POST(request("data-export", { requestId: randomUUID() }, "Ana"), {
      params: Promise.resolve({ slug: "ogs" }),
    });
    const files = unzip(new Uint8Array(await res.arrayBuffer()));
    const csv = (name: string) => files.get(name)?.toString("utf8") ?? "";
    expect(
      [csv("follow-ups.csv"), csv("follow-ups-deleted.csv")].map((f) => f.includes(requestId)),
    ).toEqual([false, true]);
  });

  it("refuses a member (401) and another workspace's officer (404); a withdrawn record is not deleted", async () => {
    const { id, requestId } = await record();
    expect(await post(remove(id, randomUUID()), "Mo")).toBe(401);
    expect(await post(remove(id, randomUUID()), "Zed")).toBe(404);
    expect(await history()).toBe(1);
    await post({ uid: 101, action: "undo", target: requestId, requestId: randomUUID() });
    expect(await post(remove(id, randomUUID()))).toBe(404);
  });

  it("Undo is the deleter's own, within UNDO_MS; a replay after Undo deletes nothing", async () => {
    const { id } = await record();
    const requestId = randomUUID();
    expect(await post(remove(id, requestId))).toBe(200);
    expect(await post(remove(id, requestId, true), "Bo")).toBe(404);
    expect(await post(remove(id, requestId, true))).toBe(200);
    expect(await history()).toBe(1);
    expect(await post(remove(id, requestId))).toBe(200);
    expect(await history()).toBe(1);
    const late = randomUUID();
    await post(remove(id, late));
    clock.now = new Date(T0.getTime() + UNDO_MS + 1);
    expect(await post(remove(id, late, true))).toBe(404);
    expect(await history()).toBe(0);
  });

  it("Undo is refused once Follow-up's Undo withdrew another record after the delete", async () => {
    const first = await record("talked");
    const second = await record("fine");
    const requestId = randomUUID();
    await post(remove(second.id, requestId));
    // Follow-up's Undo cancels the newest record counting now: the first one.
    await post({ uid: 101, action: "undo", target: first.requestId, requestId: randomUUID() });
    expect(await post(remove(second.id, requestId, true))).toBe(404);
    expect(await history()).toBe(0);
  });
});
