// The key's headroom (issue 869, D124): today's counts per feature from our own tables, the plan against the
// key's stored quota, Home's warning only when short, and no key text anywhere.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, runLogs, workspaces } from "../schema";
import { recruitReads } from "../schema-features";
import { FEATURES } from "../workspace-features";
import type { WorkspaceAccess } from "./access";
import { callsToday, headroomOf, headroomView, headroomWarning } from "./key-headroom";
import type { TrackerKeyView } from "./tracker-key";

// Thursday 13:00 ST (server time is UTC-2): no weekly reads in the plan.
const NOW = new Date("2026-11-26T15:00:00Z");
const DAY = "2026-11-26";
const OTHER_UNION = 67109944;
const KEY = "lap_abcdefghijklmnopqrstuvwxyz0123456789";

let db: Db;
let ws: number;
let other: number;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const rows = await db
    .insert(workspaces)
    .values([
      { unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
      { unionId: OTHER_UNION, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
    ])
    .returning({ id: workspaces.id });
  [ws, other] = [rows[0]?.id ?? 0, rows[1]?.id ?? 0];
  await db.insert(dailyReads).values({ day: DAY, startedAt: NOW, status: "complete" });
});

const access = (slug: string, workspaceId: number, unionId: number, on: string[] = []) =>
  ({ slug, workspaceId, unionId, features: { on: new Set(on) } }) as unknown as WorkspaceAccess;
const ogs = () => access("ogs", ws, OWN_ALLIANCE_ID, ["squads"]);
const view = (state: TrackerKeyView["state"], quotaRemaining: number | null): TrackerKeyView => ({
  state,
  last4: "6789",
  quotaRemaining,
  checkedAt: NOW,
});
const log = (code: string, data: object, unionId: number | null = null, at = NOW) =>
  db.insert(runLogs).values({ readDay: DAY, at, level: "info", code, unionId, data });

describe("callsToday", () => {
  it("counts the workspace's calls per feature for today's quota day", async () => {
    await log("squads.batch", { workspace: "ogs", calls: 40 });
    await log("squads.batch", { workspace: "ogs", calls: 10 });
    await log("shield.morning", { union_id: OWN_ALLIANCE_ID, calls: 7 }, OWN_ALLIANCE_ID);
    await log("shield.reset", { union_id: OWN_ALLIANCE_ID, calls: 3 }, OWN_ALLIANCE_ID);
    await db.insert(recruitReads).values({ workspaceId: ws, day: DAY, used: 4 });
    // Yesterday's quota day is not today's.
    await log(
      "squads.batch",
      { workspace: "ogs", calls: 99 },
      null,
      new Date("2026-11-25T23:00:00Z") /* Wednesday 21:00 ST */,
    );
    expect(await callsToday(db, ogs(), NOW)).toEqual({
      squads: 50,
      shield: 7,
      afterReset: 3,
      recruit: 4,
    });
  });

  it("never counts another workspace's logs or recruit reads", async () => {
    await log("squads.batch", { workspace: "nse", calls: 60 }, OTHER_UNION);
    await log("shield.morning", { union_id: OTHER_UNION, calls: 9 }, OTHER_UNION);
    await db.insert(recruitReads).values({ workspaceId: other, day: DAY, used: 8 });
    expect(await callsToday(db, ogs(), NOW)).toEqual({
      squads: 0,
      shield: 0,
      afterReset: 0,
      recruit: 0,
    });
  });

  it("counts a Saturday UTC line that carries Friday's read_day", async () => {
    await db.insert(dailyReads).values({ day: "2026-11-27", startedAt: NOW, status: "complete" });
    // Saturday 02:30 ST, after the 00:00 UTC reset: the morning read's line carries Friday's day.
    const at = new Date("2026-11-28T04:30:00Z");
    await db.insert(runLogs).values({
      readDay: "2026-11-27",
      at,
      level: "info",
      code: "shield.reset",
      unionId: OWN_ALLIANCE_ID,
      data: { union_id: OWN_ALLIANCE_ID, calls: 12 },
    });
    // Saturday 08:00 ST, the same quota day.
    const calls = await callsToday(db, ogs(), new Date("2026-11-28T10:00:00Z"));
    expect(calls.afterReset).toBe(12);
  });
});

describe("headroomOf", () => {
  const plan = { daily: 120, peak: 330 };
  const none = { squads: 0, shield: 0, afterReset: 0, recruit: 0 };

  it("sets what is still planned today (the plan less the counted calls) against what is left", () => {
    const h = headroomOf({ ...none, squads: 20 }, plan, 500, NOW);
    expect(h).toMatchObject({ planned: 100, left: 500, short: false });
    // Saturday (UTC) plans the weekly reads as well.
    const saturday = new Date("2026-11-28T10:00:00Z"); // Saturday 08:00 ST
    expect(headroomOf(none, plan, 500, saturday)).toMatchObject({ planned: 330, peak: true });
    expect(h.peak).toBe(false);
  });

  it("is short only when the plan needs more than is left, and never without a known quota", () => {
    expect(headroomOf(none, plan, 119, NOW).short).toBe(true);
    expect(headroomOf(none, plan, 120, NOW).short).toBe(false);
    expect(headroomOf(none, plan, null, NOW).short).toBe(false);
  });
});

describe("Home's warning", () => {
  it("shows only when the plan exceeds what is left", async () => {
    const a = access("ogs", ws, OWN_ALLIANCE_ID, [...FEATURES]);
    // No roster read: the estimate counts 100 members, squads and the weekly shield read on a Thursday.
    const short = await headroomWarning(db, a, view("ok", 10), NOW);
    expect(short).toMatchObject({ left: 10 });
    expect(short?.planned).toBeGreaterThan(10);
    expect(await headroomWarning(db, a, view("ok", 100_000), NOW)).toBeNull();
    expect(await headroomWarning(db, a, view("ok", null), NOW)).toBeNull();
    // Calls already made lower the plan below what is left.
    await log("squads.batch", { workspace: "ogs", calls: 100 });
    const planned = short?.planned ?? 0;
    expect(await headroomWarning(db, a, view("ok", planned - 50), NOW)).toBeNull();
  });
});

describe("the card's data", () => {
  it("carries no key text, only counts and the stored quota", async () => {
    await log("squads.batch", { workspace: "ogs", calls: 5, note: KEY });
    const h = await headroomView(db, ogs(), view("ok", 200), { daily: 107, peak: 107 }, NOW);
    expect(h).not.toBeNull();
    expect(JSON.stringify(h)).not.toContain("lap_");
    expect(JSON.stringify(h)).not.toContain("6789");
    expect(
      await headroomView(db, ogs(), view("none", null), { daily: 1, peak: 1 }, NOW),
    ).toBeNull();
  });
});
