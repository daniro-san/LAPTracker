import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { aliasesOf } from "../repo/member-facts";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts, pendingMembers as pendingTable } from "../schema";
import { allianceDuelPoints } from "../schema-import";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { saveFacts, type FactChange } from "./member-facts";
import {
  addPending,
  linkPending,
  matchOnRead,
  pendingMembers,
  reconcilePending,
  toMatch,
} from "./pending-members";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
const ADDED = new Date("2026-11-16T12:00:00Z");
const LATER = new Date("2026-11-16T15:00:00Z");
/** Tonight's end-of-day read (23:30 server time). */
const ROSTER_AT = new Date("2026-11-17T01:30:00Z");

let db: Db;
let ana: WorkspaceAccess;

// Invented names. Two members share the name "Corvin".
const ROSTER = [
  [11, "Zephyrine"],
  [12, "Corvin"],
  [13, "Corvin"],
  [14, "Maelis"],
] as const;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await db
    .insert(dailyReads)
    .values({ day: "2026-11-16", startedAt: ROSTER_AT, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-16",
    unionId: OGS,
    memberCount: ROSTER.length,
    sourceUpdatedAt: ROSTER_AT,
    isFresh: true,
    memberUids: ROSTER.map(([uid]) => uid),
    memberNames: ROSTER.map(([, name]) => name),
    memberPower: ROSTER.map(() => 1000),
    memberKills: ROSTER.map(() => 0),
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", ADDED);
  const { token } = await createSession(db, ws?.id ?? 0, userId, ADDED, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, ADDED);
  if (!access.ok) throw new Error("no access");
  ana = access;
});

const note = (version: number, value: string): FactChange => ({
  field: "notes",
  version,
  value,
  source: "officer",
});

/** A pending member added at `at` with a first note and, an hour later, a second one. */
async function added(name: string, at = ADDED): Promise<number> {
  const made = await addPending(
    db,
    ana,
    { requestId: randomUUID(), name, changes: [note(0, "joined today")] },
    { now: at, zone: ZONE },
  );
  const uid = made?.uid ?? 0;
  await saveFacts(db, ana, uid, [note(1, "joined today\nT10")], new Date(at.getTime() + 3600_000));
  return uid;
}

const notesOf = (uid: number) =>
  db
    .select({ version: memberFacts.version, value: memberFacts.value, at: memberFacts.writtenAt })
    .from(memberFacts)
    .where(and(eq(memberFacts.uid, uid), eq(memberFacts.field, "notes")))
    .orderBy(memberFacts.version);

describe("pending members and the roster (D106)", () => {
  it("moves the facts to the one member with the same name key, keeping versions and times", async () => {
    const pending = await added("zéphyrine");
    expect((await reconcilePending(db, ana, LATER)).moved).toBe(1);

    expect(await notesOf(11)).toEqual([
      { version: 1, value: "joined today", at: ADDED },
      { version: 2, value: "joined today\nT10", at: new Date(ADDED.getTime() + 3600_000) },
    ]);
    expect(await notesOf(pending)).toEqual([]);
    expect((await aliasesOf(db, ana.workspaceId)).get("zephyrine")).toBe(11);
    const [row] = await db.select().from(pendingTable);
    expect(row?.matchedUid).toBe(11);
    expect(await pendingMembers(db, ana)).toEqual([]);
  });

  it("keeps it pending with no match, several matches, a member with facts, or no roster since", async () => {
    await added("Nobody Here");
    await added("Corvin");
    await saveFacts(db, ana, 14, [note(0, "an officer’s note")], ADDED);
    await added("Maelis");
    // Added after tonight's read: only a later roster can list them.
    await added("Zephyrine", new Date(ROSTER_AT.getTime() + 60_000));

    expect((await reconcilePending(db, ana, LATER)).moved).toBe(0);
    expect((await pendingMembers(db, ana)).map((p) => p.name)).toEqual([
      "Nobody Here",
      "Corvin",
      "Maelis",
      "Zephyrine",
    ]);
    expect(await notesOf(14)).toHaveLength(1);
  });

  it("counts as To match once a roster read after the add still has no single match", async () => {
    await added("Corvin");
    // Added after tonight's read: not To match until a later read.
    await added("Ilsa", new Date(ROSTER_AT.getTime() + 60_000));
    await reconcilePending(db, ana, LATER);
    expect(toMatch(await pendingMembers(db, ana), ROSTER_AT).map((p) => p.name)).toEqual([
      "Corvin",
    ]);

    // The next night's read still lists two Corvins and no Ilsa.
    const next = new Date(ROSTER_AT.getTime() + 86_400_000);
    await db.insert(dailyReads).values({ day: "2026-11-17", startedAt: next, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: "2026-11-17",
      unionId: OGS,
      memberCount: ROSTER.length,
      sourceUpdatedAt: next,
      isFresh: true,
      memberUids: ROSTER.map(([uid]) => uid),
      memberNames: ROSTER.map(([, name]) => name),
      memberPower: ROSTER.map(() => 1000),
      memberKills: ROSTER.map(() => 0),
    });
    expect((await reconcilePending(db, ana, next)).moved).toBe(0);
    expect(toMatch(await pendingMembers(db, ana), next).map((p) => p.name)).toEqual([
      "Corvin",
      "Ilsa",
    ]);
  });

  it("counts Home's new members to link after the match on read", async () => {
    await added("Zephyrine");
    await added("Nobody Here");
    await added("Ilsa", new Date(ROSTER_AT.getTime() + 60_000));

    const open = await matchOnRead(db, ana, LATER);
    expect(open.map((p) => p.name)).toEqual(["Nobody Here", "Ilsa"]);
    expect(toMatch(open, ROSTER_AT)).toHaveLength(1);
  });

  it("links by hand after a member's own facts: their versions follow the member's", async () => {
    await saveFacts(db, ana, 12, [note(0, "an officer’s note")], ADDED);
    const pending = await added("Corvin");

    expect(await linkPending(db, ana, -pending, 12, LATER)).toBe("ok");
    expect((await notesOf(12)).map((n) => [n.version, n.value])).toEqual([
      [1, "an officer’s note"],
      [2, "joined today"],
      [3, "joined today\nT10"],
    ]);
    // A second link of the same pending member finds nothing; a non-member is refused.
    expect(await linkPending(db, ana, -pending, 13, LATER)).toBe("not_found");
    expect(await linkPending(db, ana, -(await added("Ilsa")), 999, LATER)).toBe("not_member");
  });

  it("moves Alliance Duel points, keeping the member's own value for a day both have", async () => {
    const pending = await added("Maelis");
    const day = (uid: number, d: "mon" | "tue", points: number) => ({
      workspaceId: ana.workspaceId,
      uid,
      week: "2026-11-16",
      day: d,
      points,
      savedAt: ADDED,
    });
    await db
      .insert(allianceDuelPoints)
      .values([day(14, "mon", 500), day(pending, "mon", 900), day(pending, "tue", 700)]);

    expect(await linkPending(db, ana, -pending, 14, LATER)).toBe("ok");
    const points = await db
      .select({
        uid: allianceDuelPoints.uid,
        day: allianceDuelPoints.day,
        points: allianceDuelPoints.points,
      })
      .from(allianceDuelPoints)
      .orderBy(allianceDuelPoints.day);
    expect(points).toEqual([
      { uid: 14, day: "mon", points: 500 },
      { uid: 14, day: "tue", points: 700 },
    ]);
  });

  it("two officers adding the same name at once with different requests get one member", async () => {
    const add = (requestId: string) =>
      addPending(db, ana, { requestId, name: "Ottoline", changes: [] }, { now: ADDED, zone: ZONE });
    const [a, b] = await Promise.all([add(randomUUID()), add(randomUUID())]);

    expect(a?.uid).toBeLessThan(0);
    expect(b?.uid).toBe(a?.uid);
    expect(await pendingMembers(db, ana)).toHaveLength(1);
  });
});
