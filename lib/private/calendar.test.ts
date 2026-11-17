import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { calendarEntries, calendarOccurrences, dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { calendarDays, createEntry, editEntry, removeEntry } from "./calendar";
import {
  DUEL_DAYS,
  fieldChange,
  newEntry as newEntrySchema,
  type FieldChange,
  type NewEntry,
} from "./calendar-model";
import { createSession } from "./session";

const OGS = 67111155;
const NSE = 67109944;
const NOW = new Date("2026-11-16T12:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  const roster = (unionId: number, uids: number[]) => ({
    readDay: "2026-11-15",
    unionId,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
  });
  await db.insert(dailyRosters).values([roster(OGS, [101, 102, 103]), roster(NSE, [201])]);
});

/** An officer signed in to `slug`, the way a sign-in makes one. */
async function signedIn(slug: string, name = "Officer"): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `${slug}-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

const newEntry = (fields: Partial<NewEntry> & Pick<NewEntry, "kind">) =>
  ({
    day: "2026-11-16",
    minute: 960,
    notes: null,
    link: null,
    forMembers: false,
    notice: null,
    ...fields,
  }) as NewEntry;

async function create(access: WorkspaceAccess, fields: Partial<NewEntry> & Pick<NewEntry, "kind">) {
  const entry = { weekly: false, ...newEntry(fields) } as NewEntry;
  const made = await createEntry(db, access, entry, randomUUID());
  if (!made.ok) throw new Error(made.code);
  return made.id;
}

const edit = (
  access: WorkspaceAccess,
  entry: number,
  week: string | null,
  ...changes: FieldChange[]
) => editEntry(db, access, { entry, week, changes }, NOW);

const shown = async (access: WorkspaceAccess, from: string, to: string) =>
  (await calendarDays(db, access, from, to)).map(
    (p) => `${p.day} ${p.minute}${p.moved ? " moved" : ""}`,
  );

describe("the workspace calendar (issue 300)", () => {
  it("keeps every entry from members until an officer switches it on", async () => {
    const ogs = await signedIn("ogs");
    await create(ogs, { kind: "kvk" });
    await create(ogs, { kind: "other", title: "Pet vote", forMembers: true } as NewEntry);
    const rows = await db.select().from(calendarEntries).orderBy(calendarEntries.id);
    expect(rows.map((r) => [r.kind, r.forMembers])).toEqual([
      ["kvk", false],
      ["other", true],
    ]);
  });

  it("adds an entry once when the retry carries the same request id (D100)", async () => {
    const ogs = await signedIn("ogs");
    const entry = { weekly: false, ...newEntry({ kind: "kvk" }) } as NewEntry;
    const id = randomUUID();
    const first = await createEntry(db, ogs, entry, id);
    expect(await createEntry(db, ogs, entry, id)).toEqual(first);
    expect(await db.select().from(calendarEntries)).toHaveLength(1);
    // Two sends with a new id at the same moment: both answer the one entry stored.
    const again = randomUUID();
    const [a, b] = await Promise.all([
      createEntry(db, ogs, entry, again),
      createEntry(db, ogs, entry, again),
    ]);
    expect(a).toEqual(b);
    expect(await db.select().from(calendarEntries)).toHaveLength(2);
  });

  it("repeats a weekly entry; one week moves or is skipped while the others follow the plan", async () => {
    const ogs = await signedIn("ogs");
    const id = await create(ogs, { kind: "caravan", weekly: true } as NewEntry);
    // Week of the 23rd only: Tuesday 20:00. Week of the 30th: moved into the next week's Monday.
    expect(
      await edit(ogs, id, "2026-11-23", {
        field: "when",
        value: { day: "2026-11-24", minute: 1200 },
        version: 0,
      }),
    ).toEqual({ ok: true });
    await edit(ogs, id, "2026-11-30", {
      field: "when",
      value: { day: "2026-12-07", minute: 900 },
      version: 0,
    });
    expect(await shown(ogs, "2026-11-16", "2026-12-13")).toEqual([
      "2026-11-16 960",
      "2026-11-24 1200 moved",
      "2026-12-07 900 moved",
      "2026-12-07 960",
    ]);
    // Every week to Wednesday 18:00: the moved weeks stay where they were put. Then the 14th is skipped,
    // and the weeks from the 21st on are ended.
    await edit(ogs, id, null, { field: "slot", value: { weekday: 2, minute: 1080 }, version: 0 });
    expect(await removeEntry(db, ogs, { entry: id, scope: "one", week: "2026-12-14" })).toBe("ok");
    await removeEntry(db, ogs, { entry: id, scope: "after", week: "2026-12-21" });
    expect(await shown(ogs, "2026-11-16", "2027-01-03")).toEqual([
      "2026-11-18 1080",
      "2026-11-24 1200 moved",
      "2026-12-07 900 moved",
      "2026-12-09 1080",
    ]);
  });

  it("seats one Coachman plus a VIP or a Guardian, never both, from the alliance's own roster", async () => {
    const ogs = await signedIn("ogs");
    const id = await create(ogs, { kind: "caravan" });
    const week = "2026-11-16";
    await edit(ogs, id, week, { field: "coach", value: { uid: 101 }, version: 0 });
    await edit(ogs, id, week, { field: "second", value: { kind: "vip", uid: 102 }, version: 0 });
    // Switching the seat to a Guardian replaces the VIP: one seat, one kind.
    expect(
      await edit(ogs, id, week, {
        field: "second",
        value: { kind: "guardian", uid: 103 },
        version: 2,
      }),
    ).toEqual({ ok: true });
    const [row] = await db.select().from(calendarOccurrences);
    expect([row?.coachName, row?.secondKind, row?.secondName]).toEqual([
      "P101",
      "guardian",
      "P103",
    ]);
    expect(await edit(ogs, id, week, { field: "coach", value: { uid: 103 }, version: 1 })).toEqual({
      ok: false,
      code: "same_person",
    });
    for (const uid of [999, 201]) {
      expect(await edit(ogs, id, week, { field: "coach", value: { uid }, version: 1 })).toEqual({
        ok: false,
        code: "not_in_alliance",
      });
    }
    const both = { field: "second", value: { kind: "vip", uid: 102, guardian: 103 }, version: 0 };
    expect(fieldChange.safeParse(both).success).toBe(false);
    expect(fieldChange.safeParse({ ...both, value: { kind: "both", uid: 102 } }).success).toBe(
      false,
    );
    const cheese = await create(ogs, { kind: "cheese", variant: "I", level: 7 } as NewEntry);
    expect(
      await edit(ogs, cheese, week, { field: "coach", value: { uid: 101 }, version: 0 }),
    ).toEqual({ ok: false, code: "invalid" });
  });

  it("refuses a field changed since the officer looked at it, with the newer value; other fields both persist", async () => {
    const ana = await signedIn("ogs", "Ana");
    const bo = await signedIn("ogs", "Bo");
    const id = await create(ana, { kind: "cheese", variant: "I", level: 7 } as NewEntry);
    expect(await edit(ana, id, null, { field: "level", value: 8, version: 0 })).toEqual({
      ok: true,
    });
    const stale = await edit(
      bo,
      id,
      null,
      { field: "level", value: 9, version: 0 },
      { field: "notes", value: "rally at 17:50", version: 0 },
    );
    expect(stale).toMatchObject({
      ok: false,
      code: "stale",
      conflicts: [{ field: "level", value: 8, version: 1, by: "Ana", at: NOW.toISOString() }],
    });
    // Nothing of the refused save was written; a different field alone goes through.
    expect(
      await edit(bo, id, null, { field: "notes", value: "rally at 17:50", version: 0 }),
    ).toEqual({ ok: true });
    expect(await edit(bo, id, null, { field: "level", value: 9, version: 1 })).toEqual({
      ok: true,
    });
    const [row] = await db.select().from(calendarEntries);
    expect([row?.level, row?.notes]).toEqual([9, "rally at 17:50"]);
  });

  it("shows and changes an entry only inside its own workspace (D71)", async () => {
    const ogs = await signedIn("ogs");
    const nse = await signedIn("nse");
    const id = await create(ogs, { kind: "kvk" });
    expect(await calendarDays(db, nse, "2026-11-16", "2026-11-22")).toEqual([]);
    expect(await edit(nse, id, null, { field: "notes", value: "x", version: 0 })).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(await removeEntry(db, nse, { entry: id, scope: "all", week: "2026-11-16" })).toBe(
      "not_found",
    );
    expect(await calendarDays(db, ogs, "2026-11-16", "2026-11-22")).toHaveLength(1);
  });
  it("follows the owner's rules: Elixir windows, levels 1 to 10, one theme per week, the daily themes", async () => {
    const ogs = await signedIn("ogs");
    const elixir = { kind: "elixir", variant: "A", day: "2026-11-20", forMembers: false };
    expect(newEntrySchema.safeParse({ ...elixir, minute: 22 * 60 }).success).toBe(false);
    expect(newEntrySchema.safeParse({ ...elixir, minute: 23 * 60 }).success).toBe(true);
    for (const level of [0, 11]) {
      expect(
        newEntrySchema.safeParse({ kind: "undead", day: "2026-11-17", minute: 1080, level })
          .success,
      ).toBe(false);
      expect(fieldChange.safeParse({ field: "level", value: level, version: 0 }).success).toBe(
        false,
      );
    }
    const theme = (day: string) =>
      createEntry(
        db,
        ogs,
        newEntry({ kind: "duel", day, title: "economy week" } as NewEntry),
        randomUUID(),
      );
    expect((await theme("2026-11-18")).ok).toBe(true);
    expect(await theme("2026-11-20")).toEqual({ ok: false, code: "theme_exists" });
    const [row] = await db.select().from(calendarEntries);
    expect([row?.day, row?.minute]).toEqual(["2026-11-16", null]);
    expect([DUEL_DAYS[0], DUEL_DAYS[6]]).toEqual(["Raven", null]);
  });
});
