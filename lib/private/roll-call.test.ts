import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createEntry } from "./calendar";
import type { NewEntry } from "./calendar-model";
import { saveFacts } from "./member-facts";
import { addCall, markOne, markRest, setTeam, undoMarks, type Occasion } from "./roll-call";
import { callView, teamView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const UIDS = [101, 102, 103, 104];

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
    memberNames: UIDS.map((u) => `P${u}`),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
});

async function signedIn(name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function calendarOccasion(access: WorkspaceAccess, entry: Partial<NewEntry>) {
  const made = await createEntry(
    db,
    access,
    {
      day: "2026-11-21",
      minute: 720,
      notes: null,
      link: null,
      forMembers: false,
      weekly: false,
      ...entry,
    } as NewEntry,
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  return { entry: made.id, week: "2026-11-16" };
}

const mark = (
  access: WorkspaceAccess,
  occasion: Occasion,
  uid: number,
  m: "yes" | "no" | null,
  version: number,
) => markOne(db, access, { occasion, uid, mark: m, version }, NOW);

/** Each member's mark by uid (the page's own order is tested in roll-call-rules.test.ts). */
const shown = async (access: WorkspaceAccess, occasion: Occasion) =>
  (await callView(db, access, occasion, "en"))?.rows
    .map((r) => `${r.uid}:${r.mark ?? "-"}${r.away ? " away" : ""}`)
    .sort();

describe("roll call writes (issue 298)", () => {
  it("refuses a mark based on an older version with the newer one, unless both said the same", async () => {
    const [ana, bo] = [await signedIn("Ana"), await signedIn("Bo")];
    const kvk = await calendarOccasion(ana, { kind: "kvk" });
    expect(await mark(ana, kvk, 101, "no", 0)).toEqual({ ok: true, version: 1 });
    const refused = await mark(bo, kvk, 101, "yes", 0);
    expect(refused).toMatchObject({
      ok: false,
      code: "stale",
      kind: "shield",
      newest: { mark: "no", version: 1, by: "Ana" },
    });
    expect(await mark(bo, kvk, 101, "no", 0)).toEqual({ ok: true, version: 1 });
    expect(await mark(bo, kvk, 101, "yes", 1)).toEqual({ ok: true, version: 2 });
    expect(await mark(ana, kvk, 999, "yes", 0)).toEqual({ ok: false, code: "not_member" });
  });

  it("fills only the not set with the kind's rest, skips the away, and undoes only what nobody changed", async () => {
    const ana = await signedIn("Ana");
    await saveFacts(
      db,
      ana,
      104,
      [
        {
          field: "away",
          version: 0,
          value: { text: "trip", from: "2026-11-20", until: "2026-11-23" },
          source: "officer",
        },
      ],
      NOW,
    );
    const kvk = await calendarOccasion(ana, { kind: "kvk" });
    await mark(ana, kvk, 101, "no", 0);
    const rest = await markRest(db, ana, { occasion: kvk, uids: UIDS }, NOW);
    expect(rest).toMatchObject({
      ok: true,
      mark: "assumed",
      written: [{ uid: 102 }, { uid: 103 }],
    });
    expect(await shown(ana, kvk)).toEqual(["101:no", "102:assumed", "103:assumed", "104:- away"]);
    await mark(ana, kvk, 103, "yes", 1);
    await undoMarks(db, ana, { occasion: kvk, items: rest.ok ? rest.written : [] }, NOW);
    expect(await shown(ana, kvk)).toEqual(["101:no", "102:-", "103:yes", "104:- away"]);
  });

  it("keeps an Elixir Scramble team to 20 and one team per member a week; its roll call asks only the team", async () => {
    const ana = await signedIn("Ana");
    const a = await calendarOccasion(ana, {
      kind: "elixir",
      variant: "A",
      minute: 1080,
      day: "2026-11-20",
    } as Partial<NewEntry>);
    const b = await calendarOccasion(ana, {
      kind: "elixir",
      variant: "B",
      minute: 1380,
      day: "2026-11-20",
    } as Partial<NewEntry>);
    expect(await setTeam(db, ana, { occasion: a, uids: [101, 102], on: true }, NOW)).toEqual({
      ok: true,
      added: [101, 102],
      count: 2,
    });
    expect(await setTeam(db, ana, { occasion: b, uids: [101], on: true }, NOW)).toEqual({
      ok: false,
      code: "other_team",
    });
    const team = await teamView(db, ana, b, "en", "Etc/GMT+2");
    expect(team?.rows.find((r) => r.uid === 101)?.other).toBe("A");
    expect(await shown(ana, a)).toEqual(["101:-", "102:-"]);
    const rest = await markRest(db, ana, { occasion: a, uids: UIDS }, NOW);
    expect(rest).toMatchObject({ mark: "no", written: [{ uid: 101 }, { uid: 102 }] });
    // A newer roster of 30: the team stops at 20, then refuses one more.
    const more = Array.from({ length: 30 }, (_, i) => 201 + i);
    await db.insert(dailyReads).values({ day: "2026-11-16", startedAt: NOW, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: "2026-11-16",
      unionId: OGS,
      memberCount: more.length,
      isFresh: true,
      sourceUpdatedAt: new Date(NOW.getTime() + 60_000),
      memberUids: more,
      memberNames: more.map((u) => `P${u}`),
      memberPower: more.map(() => 1000),
      memberKills: more.map(() => 0),
    });
    const filled = await setTeam(db, ana, { occasion: a, uids: more, on: true }, NOW);
    expect(filled).toMatchObject({ ok: true, count: 20 });
    expect(filled.ok && filled.added).toEqual(more.slice(0, 18));
    expect(await setTeam(db, ana, { occasion: a, uids: [230], on: true }, NOW)).toEqual({
      ok: false,
      code: "full",
    });
  });

  it("opens the same hand-added roll call for a repeated request or the same kind and day", async () => {
    const ana = await signedIn("Ana");
    const id = randomUUID();
    const first = await addCall(db, ana, { kind: "plunder", day: "2026-11-18" }, id);
    expect(await addCall(db, ana, { kind: "plunder", day: "2026-11-18" }, id)).toEqual(first);
    expect(await addCall(db, ana, { kind: "plunder", day: "2026-11-18" }, randomUUID())).toEqual(
      first,
    );
    expect(await addCall(db, ana, { kind: "raid", day: "2026-11-18" }, randomUUID())).not.toEqual(
      first,
    );
  });
});
