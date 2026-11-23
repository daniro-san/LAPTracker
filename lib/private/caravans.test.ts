import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { endOfDayReads } from "../repo/workspace-rosters";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { calendarDays, createEntry } from "./calendar";
import type { NewEntry } from "./calendar-model";
import { caravanSuggestions } from "./caravans";
import { WEEK_READS, weekQuestPoints } from "./member-week";
import { teamView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
// Monday 23 01:40 UTC: Sunday 23:40 ST, after Sunday's end-of-day read.
const NOW = new Date("2026-11-23T01:40:00Z");
const UIDS = [101, 102, 103, 104];
const ZONE = "Etc/GMT+2";
/**
 * Each member's `active` on the week's seven end-of-day reads, Monday 16 to Sunday 22: the running total
 * since Monday's reset (#739). 101 earned 240 on Monday and Tuesday and nothing after (week 480), 102
 * earned 230 on Sunday only, 103 nothing, 104 100 every day (week 700). The week ranks 104, 101, 102, 103;
 * the reads added up would rank 101 (3,120) above 104 (2,800), and Sunday alone 102, 104, 101.
 */
const ACTIVE: [string, (number | null)[]][] = [
  ["2026-11-16", [240, null, null, 100]],
  ["2026-11-17", [480, null, null, 200]],
  ["2026-11-18", [480, null, null, 300]],
  ["2026-11-19", [480, null, null, 400]],
  ["2026-11-20", [480, null, null, 500]],
  ["2026-11-21", [480, null, null, 600]],
  ["2026-11-22", [480, 230, null, 700]],
];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  for (const [i, [day, points]] of ACTIVE.entries()) {
    await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId: OGS,
      memberCount: UIDS.length,
      isFresh: true,
      sourceUpdatedAt: new Date(NOW.getTime() + i * 60_000),
      memberUids: UIDS,
      memberNames: UIDS.map((u) => `P${u}`),
      memberPower: UIDS.map(() => 1000),
      memberKills: UIDS.map(() => 0),
      rawJson: {
        members: UIDS.map((uid, j) => ({ uid, nick_name: `P${uid}`, active: points[j] })),
      },
    });
  }
});

async function signedIn(name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function entry(access: WorkspaceAccess, e: Partial<NewEntry>) {
  const base = { day: "2026-11-20", minute: 1080, notes: null, link: null, forMembers: false };
  const made = await createEntry(
    db,
    access,
    { ...base, notice: null, weekly: false, ...e } as NewEntry,
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  return { entry: made.id, week: "2026-11-16" };
}

describe("the week's daily quest points in the picks (D127, #739)", () => {
  it("is Sunday's running total, never the week's reads added up, and ranks caravan suggestions and Elixir team picks by it", async () => {
    const reads = await endOfDayReads(db, OGS, WEEK_READS);
    expect(UIDS.map((uid) => weekQuestPoints(reads, uid))).toEqual([480, 230, null, 700]);

    const ana = await signedIn("Ana");
    await entry(ana, { kind: "caravan" });
    const caravans = await calendarDays(db, ana, "2026-11-16", "2026-11-22");
    const [suggested] = (await caravanSuggestions(db, ana, caravans, ZONE)).values();
    expect(suggested?.map((s) => s.uid)).toEqual([104, 101, 102]);

    const elixir = await entry(ana, { kind: "elixir", variant: "A" } as Partial<NewEntry>);
    const team = await teamView(db, ana, elixir, "en", ZONE);
    expect(team?.rows.map((r) => r.uid)).toEqual([104, 101, 102, 103]);
  });
});
