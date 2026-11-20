import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { calendarDays, createEntry } from "./calendar";
import type { NewEntry } from "./calendar-model";
import { caravanSuggestions } from "./caravans";
import { teamView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-18T12:00:00Z");
const UIDS = [101, 102, 103, 104];
const ZONE = "Etc/GMT+2";
/**
 * Each member's daily quest points (`active`) on three end-of-day reads. The newest day alone ranks 102
 * (500), 104 (100), then 101 and 103 with none; the week ranks 101 (900), 102 (500), 104 (300), 103.
 */
const ACTIVE: [string, (number | null)[]][] = [
  ["2026-11-16", [600, null, null, 100]],
  ["2026-11-17", [300, null, null, 100]],
  ["2026-11-18", [null, 500, null, 100]],
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

describe("the week's daily quest points in the picks (D127)", () => {
  it("ranks caravan suggestions and Elixir team picks by the week's sum, not the newest day's", async () => {
    const ana = await signedIn("Ana");
    await entry(ana, { kind: "caravan" });
    const caravans = await calendarDays(db, ana, "2026-11-16", "2026-11-22");
    const [suggested] = (await caravanSuggestions(db, ana, caravans, ZONE)).values();
    expect(suggested?.map((s) => s.uid)).toEqual([101, 102, 104]);

    const elixir = await entry(ana, { kind: "elixir", variant: "A" } as Partial<NewEntry>);
    const team = await teamView(db, ana, elixir, "en", ZONE);
    expect(team?.rows.map((r) => r.uid)).toEqual([101, 102, 104, 103]);
  });
});
