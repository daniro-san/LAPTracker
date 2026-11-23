// One average rule (owner, 2026-11-22, #663; issue 585 batch 4 S1b): the member card's Last 7 days, a
// member's own page and Insights' effort, read from the same end-of-day rosters in PGlite, give the same
// average and the same count of "none" days. A "none" day counts as 0; a day with no daily update never
// counts; a week of only "none" days never reads "Average 0". Invented values only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { endOfDayReads } from "../repo/workspace-rosters";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type MeAccess, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { EFFORT_READS, effortsOf } from "./insights-rules";
import { meView } from "./me";
import { memberCard } from "./member-card";
import { averageLine } from "./member-days";
import { createSession } from "./session";

const OURS = 67111166;
const [WREN, LARK] = [101, 102];
// Sunday 23:40 ST, after the day's daily update.
const NOW = new Date("2026-11-23T01:40:00Z");
const ZONE = "Etc/GMT+2";
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

/**
 * Our end-of-day roster of `day`: Wren sends `wren` in coins and donations and `total`, the week's running
 * total, in quest points (#739); Lark sends nothing (null).
 */
async function roster(day: string, wren: number | null, total: number) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OURS,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: [WREN, LARK],
    memberNames: ["Wren", "Lark"],
    memberPower: [2_000_000, 1_000_000],
    memberKills: [0, 0],
    rawJson: {
      members: [
        {
          uid: WREN,
          nick_name: "Wren",
          power: 2_000_000,
          active: total,
          daily_honor: wren,
          daily_tech: wren,
        },
        {
          uid: LARK,
          nick_name: "Lark",
          power: 1_000_000,
          active: null,
          daily_honor: null,
          daily_tech: null,
        },
      ],
    },
  });
}

/** An officer of a new "ogs" workspace on our alliance. */
async function officer() {
  await saveWorkspace(db, {
    unionId: OURS,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = (await findWorkspaceBySlug(db, "ogs"))?.id ?? 0;
  const user = await recordSignIn(db, ws, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws, user, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** One member's rows on the card and on Me, and their Insights effort, each read the page's own way. */
async function pagesOf(access: WorkspaceAccess, uid: number) {
  const at = { now: NOW, zone: ZONE, language: "en" as const, t };
  // The member's own page behind an approved link (D142); the link itself is tested in the me route.
  const me = { workspaceId: access.workspaceId, unionId: OURS, uid } as unknown as MeAccess;
  const [card, own, reads] = await Promise.all([
    memberCard(db, access, uid, at),
    meView(db, me, { ...at, endRead: "16:15" }),
    endOfDayReads(db, OURS, EFFORT_READS),
  ]);
  return {
    card: card?.days?.rows ?? [],
    week: own.left ? [] : (own.week?.rows ?? []),
    effort: effortsOf(reads, new Set()).find((e) => e.uid === uid),
  };
}

describe("one average for a member on the card, Me and Insights (#663)", () => {
  it("counts a none day as 0 and names it, leaves the day with no daily update out, and says an all-none week as such", async () => {
    // Mon to Sun, Nov 16–22: coins and donations 600, none, none, 600, no daily update (Friday), 600, 600;
    // quest points 200, none, none, 200, no daily update, then 200 on Saturday and Sunday, so Wren's
    // Saturday is not known (no Friday read to take it from); Lark's is none, with nothing all week (#739).
    for (const [day, wren, total] of [
      ["2026-11-16", 600, 200],
      ["2026-11-17", null, 200],
      ["2026-11-18", null, 200],
      ["2026-11-19", 600, 400],
      ["2026-11-21", 600, 600],
      ["2026-11-22", 600, 800],
    ] as const)
      await roster(day, wren, total);
    const access = await officer();

    const wren = { line: "Average 400 · 6 days, of which 2 none", value: 400, days: 6, none: 2 };
    const lark = { line: "None on all 6 days", value: 0, days: 6, none: 6 };
    const wrenQuests = {
      line: "Average 120 · 5 days, of which 2 none",
      value: 120,
      days: 5,
      none: 2,
    };
    for (const [uid, expected] of [
      [WREN, { quests: wrenQuests, coins: wren, tech: wren }],
      [LARK, { quests: lark, coins: lark, tech: lark }],
    ] as const) {
      const { card, week, effort } = await pagesOf(access, uid);
      for (const [i, metric] of (["quests", "coins", "tech"] as const).entries()) {
        const insights = effort?.[metric] ?? null;
        const { line, ...average } = expected[metric];

        expect(insights, `${uid} ${metric}`).toEqual(average);
        expect(card[i]?.average, `${uid} ${metric}`).toBe(line);
        expect(week[i]?.average, `${uid} ${metric}`).toBe(`This week: ${line}`);
        // Insights' own average written by the same words: the same line as the card's and Me's.
        expect(averageLine(insights, t, (n) => String(n), "en")).toBe(line);
        // Friday had no daily update: the no-data mark on both, never "none" or 0.
        expect([card[i]?.bars[4]?.value, week[i]?.bars[4]?.value]).toEqual(["—", "—"]);
      }
    }
  });
});
