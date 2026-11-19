import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, rollCalls, rollCallMarks } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createEntry } from "./calendar";
import { removeEntry } from "./calendar-delete";
import type { NewEntry } from "./calendar-model";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { saveFacts } from "./member-facts";
import { addCall, markOne, markRest, undoMarks, type Occasion } from "./roll-call";
import { setTeam } from "./roll-call-team";
import { callView, teamView, weekItems } from "./roll-call-view";
import { callTitle } from "./roll-call-words";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const UIDS = [101, 102, 103, 104];
/** The server's clock (SERVER_TZ), UTC−2. */
const ZONE = "Etc/GMT+2";
const CLOCK = { now: NOW, zone: ZONE };

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
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
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
      notice: null,
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
  (await callView(db, access, occasion, "en", ZONE))?.rows
    .map((r) => `${r.uid}:${r.mark ?? "-"}${r.away ? " away" : ""}`)
    .sort();

/** A Cheese Trap Calendar entry (I or II, Lv.7) on the test day. */
const cheeseTrap = (variant: "I" | "II") =>
  ({ kind: "cheese", variant, level: 7 }) as Partial<NewEntry>;

/** The roll call's title as its page shows it, in English. */
const titled = async (access: WorkspaceAccess, occasion: Occasion) => {
  const view = await callView(db, access, occasion, "en", ZONE);
  return view && callTitle(view.opened, WORKSPACE_DICTIONARIES.en);
};

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
    const rest = await markRest(db, ana, { occasion: kvk, uids: UIDS }, CLOCK);
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
    expect(await setTeam(db, ana, { occasion: a, uids: [101, 101, 102], on: true }, NOW)).toEqual({
      ok: true,
      added: [101, 102],
      count: 2,
    });
    expect(await setTeam(db, ana, { occasion: b, uids: [101], on: true }, NOW)).toEqual({
      ok: false,
      code: "other_team",
    });
    // Two officers adding the same member to A and B at once: the week's lock lets one in.
    const both = await Promise.all([
      setTeam(db, ana, { occasion: a, uids: [103], on: true }, NOW),
      setTeam(db, ana, { occasion: b, uids: [103], on: true }, NOW),
    ]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    await setTeam(db, ana, { occasion: a, uids: [103], on: false }, NOW);
    await setTeam(db, ana, { occasion: b, uids: [103], on: false }, NOW);
    const team = await teamView(db, ana, b, "en", ZONE);
    expect(team?.rows.find((r) => r.uid === 101)?.other).toBe("A");
    expect(await shown(ana, a)).toEqual(["101:-", "102:-"]);
    const rest = await markRest(db, ana, { occasion: a, uids: UIDS }, CLOCK);
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
    const add = (kind: "cheese" | "raid", id = randomUUID()) =>
      addCall(db, ana, { kind, day: "2026-11-18" }, id);
    const id = randomUUID();
    const first = await add("cheese", id);
    expect(await add("cheese", id)).toEqual(first);
    // Two officers adding it at once: the unique index lets one in, the other opens it.
    expect(await Promise.all([add("cheese"), add("cheese")])).toEqual([first, first]);
    expect(await add("raid")).not.toEqual(first);
  });

  it("gives a Cheese Trap Calendar entry its roll call, titled as the Calendar", async () => {
    const ana = await signedIn("Ana");
    const cheese = await calendarOccasion(ana, cheeseTrap("II"));
    const [item] = await weekItems(db, ana, cheese.week, ZONE);
    expect(item).toMatchObject({ kind: "cheese", occasion: cheese });
    expect(await titled(ana, cheese)).toBe("Cheese Trap II · Lv.7");
  });

  it("fills a Cheese Trap's rest with took part, keeping a ✗", async () => {
    const ana = await signedIn("Ana");
    const cheese = await calendarOccasion(ana, cheeseTrap("II"));
    await mark(ana, cheese, 101, "no", 0);
    const rest = await markRest(db, ana, { occasion: cheese, uids: UIDS }, CLOCK);
    expect(rest).toMatchObject({ ok: true, mark: "yes" });
    expect(await shown(ana, cheese)).toEqual(["101:no", "102:yes", "103:yes", "104:yes"]);
  });

  it("keeps Cheese Trap I and II on the same day as two roll calls, each with its own counts", async () => {
    const ana = await signedIn("Ana");
    const one = await calendarOccasion(ana, cheeseTrap("I"));
    const two = await calendarOccasion(ana, { ...cheeseTrap("II"), minute: 900 });
    await mark(ana, one, 101, "yes", 0);
    await mark(ana, two, 102, "no", 0);
    const items = await weekItems(db, ana, one.week, ZONE);
    expect(items.map((i) => [i.occasion, i.tally.yes, i.tally.no])).toEqual([
      [one, 1, 0],
      [two, 0, 1],
    ]);
  });

  it("keeps a started Cheese Trap on the week when its entry is deleted, with its mark, titled Cheese Trap", async () => {
    const ana = await signedIn("Ana");
    const cheese = await calendarOccasion(ana, cheeseTrap("II"));
    await mark(ana, cheese, 101, "yes", 0);
    await removeEntry(
      db,
      ana,
      { entry: cheese.entry, scope: "all", week: cheese.week, requestId: randomUUID() },
      NOW,
    );
    const [item, ...more] = await weekItems(db, ana, cheese.week, ZONE);
    expect([item?.kind, item?.placed, item?.tally.yes, more.length]).toEqual([
      "cheese",
      null,
      1,
      0,
    ]);
    expect(item && (await titled(ana, item.occasion))).toBe("Cheese Trap");
  });

  it("still lists a plunder roll call saved before 2026-11-17, with its marks and no rest", async () => {
    const ana = await signedIn("Ana");
    const [old] = await db
      .insert(rollCalls)
      .values({
        workspaceId: ana.workspaceId,
        kind: "plunder",
        day: "2026-11-17",
        week: "2026-11-16",
        requestId: randomUUID(),
      })
      .returning({ id: rollCalls.id });
    const id = old?.id ?? 0;
    await db
      .insert(rollCallMarks)
      .values({ rollCallId: id, uid: 102, version: 1, mark: "yes", writtenAt: NOW });
    const items = await weekItems(db, ana, "2026-11-16", ZONE);
    expect(items.map((i) => [i.kind, i.tally.yes])).toEqual([["plunder", 1]]);
    expect(await titled(ana, { id })).toBe("Plunders");
    const rest = await markRest(db, ana, { occasion: { id }, uids: UIDS }, CLOCK);
    expect(rest).toEqual({ ok: false, code: "invalid" });
  });

  it("keeps a started roll call on the week when its Calendar entry is deleted, with its marks", async () => {
    const ana = await signedIn("Ana");
    const kvk = await calendarOccasion(ana, { kind: "kvk" });
    await mark(ana, kvk, 101, "yes", 0);
    await removeEntry(
      db,
      ana,
      { entry: kvk.entry, scope: "all", week: kvk.week, requestId: randomUUID() },
      NOW,
    );
    const items = await weekItems(db, ana, kvk.week, ZONE);
    expect(items.map((i) => [i.kind, i.placed, i.tally.yes, "id" in i.occasion])).toEqual([
      ["shield", null, 1, true],
    ]);
  });

  it("does not reach into the past: a note saved today without a first day leaves past roll calls alone", async () => {
    const ana = await signedIn("Ana");
    const past = await addCall(db, ana, { kind: "raid", day: "2026-11-14" }, randomUUID());
    const note = { text: "", until: "2026-11-25" };
    await saveFacts(
      db,
      ana,
      104,
      [{ field: "away", version: 0, value: note, source: "officer" }],
      NOW,
      ZONE,
    );
    expect(await shown(ana, { id: past.id })).toContain("104:-");
    const today = await addCall(db, ana, { kind: "raid", day: "2026-11-16" }, randomUUID());
    expect(await shown(ana, { id: today.id })).toContain("104:- away");
  });
});
