// An Elixir Scramble team's page (D103) against a real Postgres (PGlite): a picked member away on the
// team's day is flagged on their row (issue 585), and an unpicked one is left out of the suggestions and
// counted apart. Names are invented.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace } from "./access";
import { createEntry } from "./calendar";
import type { NewEntry } from "./calendar-model";
import { saveFacts } from "./member-facts";
import { setTeam } from "./roll-call-team";
import { teamView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const UIDS = [101, 102, 103, 104];
const ZONE = "Etc/GMT+2";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: UIDS,
    memberNames: UIDS.map((u) => `Wren ${u}`),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
});

async function officer() {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

describe("an Elixir Scramble team's away members (issue 585)", () => {
  it("flags a picked member away on the team's day, and counts an unpicked one apart", async () => {
    const ana = await officer();
    const away = { text: "trip", from: "2026-11-19", until: "2026-11-23" };
    for (const uid of [101, 103]) {
      const fact = { field: "away" as const, version: 0, value: away, source: "officer" as const };
      await saveFacts(db, ana, uid, [fact], NOW);
    }
    const entry = { kind: "elixir", variant: "A", day: "2026-11-20", minute: 1080 };
    const made = await createEntry(
      db,
      ana,
      {
        notes: null,
        link: null,
        forMembers: false,
        notice: null,
        weekly: false,
        ...entry,
      } as NewEntry,
      randomUUID(),
    );
    if (!made.ok) throw new Error(made.code);
    const occasion = { entry: made.id, week: "2026-11-16" };
    await setTeam(db, ana, { occasion, uids: [101, 102], on: true }, NOW);
    const team = await teamView(db, ana, occasion, "en", ZONE);
    expect(team?.rows.filter((r) => r.picked).map((r) => [r.uid, r.away])).toEqual([
      [101, true],
      [102, false],
    ]);
    expect(team?.rows.some((r) => r.uid === 103)).toBe(false);
    expect(team?.away).toBe(1);
  });
});
