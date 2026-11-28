// Alliance Duel by week (issue 467, D75): a week with no saved picture is "no data", never 0; the averages
// count only the weeks that have data; "most improved" is in name order and leaves out whoever lacks a
// week; another workspace's points are never read. Invented names and numbers.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { allianceDuelPoints } from "../schema-import";
import { requireWorkspace } from "./access";
import { duelHistory, duelTotals, mostImproved, type DuelTotal } from "./duel-history";
import { createSession } from "./session";

const NOW = new Date("2026-11-22T12:00:00Z");
const row = (uid: number, week: string, points: number): DuelTotal => ({ uid, week, points });

describe("a member's Alliance Duel weeks", () => {
  it("shows a week with nothing saved as no data, not 0, and averages only the weeks with points", () => {
    const rows = [row(1, "2026-11-02", 4_000_000), row(1, "2026-11-16", 6_000_000)];
    const h = duelHistory(rows, new Set([1]), 1, "2026-11-23");
    expect(h?.weeks).toHaveLength(8);
    expect(h?.weeks.at(-2)).toEqual({ week: "2026-11-16", points: 6_000_000 });
    // 2026-11-09 has no saved picture: null, and it does not lower the average.
    expect(h?.weeks.find((w) => w.week === "2026-11-09")?.points).toBeNull();
    expect(h?.average).toEqual({ value: 5_000_000, weeks: 2 });
  });

  it("gives the alliance's weekly average over the weeks that have data only", () => {
    const rows = [
      row(1, "2026-11-02", 4_000_000),
      row(2, "2026-11-02", 2_000_000),
      row(1, "2026-11-16", 10_000_000),
      row(2, "2026-11-16", 6_000_000),
      // Not in the alliance's roster: left out of its totals.
      row(9, "2026-11-16", 90_000_000),
    ];
    const h = duelHistory(rows, new Set([1, 2]), 1, "2026-11-23");
    expect(h?.alliance).toEqual({ value: 11_000_000, weeks: 2 });
  });

  it("has nothing to show before any week is saved", () => {
    expect(duelHistory([], new Set([1]), 1, "2026-11-16")).toBeNull();
  });
});

describe("most improved in Alliance Duel (D75)", () => {
  it("names them in alphabetical order, and leaves out whoever lacks a week or did not improve", () => {
    const members = [
      { uid: 1, name: "Wren" },
      { uid: 2, name: "Ilsa" },
      { uid: 3, name: "Bramble" },
      { uid: 4, name: "Tobiah" },
      { uid: 5, name: "Quill" },
    ];
    const rows = [
      row(1, "2026-11-09", 1_000_000),
      row(1, "2026-11-16", 1_500_000),
      row(2, "2026-11-09", 2_000_000),
      row(2, "2026-11-16", 2_400_000),
      row(3, "2026-11-02", 1_000_000),
      row(3, "2026-11-16", 2_000_000),
      // Fell: not named, and not named as anything else.
      row(4, "2026-11-09", 3_000_000),
      row(4, "2026-11-16", 1_000_000),
      // No picture of the newest week for Quill: missing data, left out.
      row(5, "2026-11-02", 1_000_000),
      row(5, "2026-11-09", 1_000_000),
    ];
    expect(mostImproved(rows, members, "2026-11-23")).toEqual(["Bramble", "Ilsa", "Wren"]);
  });
});

describe("the week still running (orchestrator decision on #467)", () => {
  it("is shown, but a partial current week leaves the averages and most improved unchanged", () => {
    const members = [{ uid: 1, name: "Wren" }];
    const done = [
      row(1, "2026-11-02", 1_000_000),
      row(1, "2026-11-09", 1_500_000),
      row(2, "2026-11-09", 500_000),
    ];
    const running = [...done, row(1, "2026-11-16", 100_000), row(2, "2026-11-16", 100_000)];
    const before = duelHistory(done, new Set([1, 2]), 1, "2026-11-16");
    const during = duelHistory(running, new Set([1, 2]), 1, "2026-11-16");
    expect(during?.weeks.at(-1)).toEqual({ week: "2026-11-16", points: 100_000 });
    expect(during?.average).toEqual(before?.average);
    expect(during?.alliance).toEqual(before?.alliance);
    expect(mostImproved(running, members, "2026-11-16")).toEqual(["Wren"]);
  });
});

describe("the workspace's own Alliance Duel rows", () => {
  let db: Db;
  beforeAll(async () => {
    db = await openTestDb();
  });
  beforeEach(async () => {
    await truncateAll(db);
  });

  it("never reads another workspace's points", async () => {
    await saveWorkspace(db, {
      unionId: 111,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
    });
    await saveWorkspace(db, {
      unionId: 222,
      slug: "other",
      discordGuildId: "3",
      leaderRoleIds: ["4"],
    });
    const ours = await findWorkspaceBySlug(db, "ogs");
    const theirs = await findWorkspaceBySlug(db, "other");
    const userId = await recordSignIn(db, ours?.id ?? 0, "ana", "Ana", NOW);
    const { token } = await createSession(db, ours?.id ?? 0, userId, NOW, null, "officer");
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no access");
    const at = (workspaceId: number | undefined, uid: number, points: number) => ({
      workspaceId: workspaceId ?? 0,
      uid,
      week: "2026-11-16",
      day: "week" as const,
      points,
      savedAt: NOW,
    });
    await db
      .insert(allianceDuelPoints)
      .values([at(ours?.id, 1, 5_000_000), at(theirs?.id, 1, 70_000_000), at(theirs?.id, 2, 1)]);
    expect(await duelTotals(db, access, "2026-11-16")).toEqual([row(1, "2026-11-16", 5_000_000)]);
  });
});
