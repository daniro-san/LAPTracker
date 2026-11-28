// Test-only (D125): one workspace with a row in every table it owns (lib/repo/workspace-data.ts), a deleted
// record where a table keeps them, a sealed key and a session, and a roster whose raw_json carries the
// private fields with marker values. Invented names and values only.
import { eq, getTableName } from "drizzle-orm";

import type { Db } from "./db";
import { ownedBy, WORKSPACE_TABLES } from "./repo/workspace-data";
import {
  calendarEntries,
  calendarOccurrences,
  dailyReads,
  dailyRosters,
  garrisonPlans,
  kvkClaims,
  kvkPlans,
  memberFacts,
  memberSelfReports,
  nameAliases,
  pendingMembers,
  workspaces,
  workspaceSessions,
  workspaceUsers,
} from "./schema";
import { startHere, thanksShares, thanksTakedowns } from "./schema-board";
import { workspaceGlossary } from "./schema-features";
import {
  DAY,
  id,
  SEED_AT,
  seedCallsAndThefts,
  seedImports,
  seedKeyAndData,
  seedNotices,
  seedRaid,
  seedRecruitReads,
  WEEK,
} from "./workspace-seed-parts.test-helpers";

export { KEY_MARKER, PICTURE, SEED_AT } from "./workspace-seed-parts.test-helpers";

/** Values that must never leave in a download: the roster's private fields (x, y, last online, photo). */
export const PRIVATE_MARKERS = ["98765", "54321", "1795000000", "avatar.example.test"];

/** Every row the workspace owns (D125's list) and its own row, as JSON: to show none of it changed. */
export async function ownedRows(db: Db, ws: { id: number; unionId: number }) {
  const out: Record<string, unknown> = {};
  for (const t of WORKSPACE_TABLES)
    out[getTableName(t.table)] = await db.select().from(t.table).where(ownedBy(t, ws));
  out.workspace = await db.select().from(workspaces).where(eq(workspaces.id, ws.id));
  return JSON.parse(JSON.stringify(out)) as unknown;
}

/** The day's roster of the alliance, with every private field the upstream sends, in raw_json. */
export async function seedRoster(db: Db, unionId: number) {
  await db.insert(dailyReads).values({ day: DAY, startedAt: SEED_AT, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId,
    memberCount: 1,
    sourceUpdatedAt: SEED_AT,
    isFresh: true,
    memberUids: [101],
    memberNames: ["Ana Example"],
    memberPower: [1000],
    memberKills: [10],
    rawJson: {
      members: [
        {
          uid: 101,
          nick_name: "Ana Example",
          x: 98765,
          y: 54321,
          online: true,
          last_online_at: 1795000000,
          avatar_url: "https://avatar.example.test/a.png",
        },
      ],
    },
  });
}

/** A workspace and its officer, with a session row (a route test makes its own cookie's session). */
export async function seedWorkspace(db: Db, slug: string, unionId: number) {
  const [w] = await db
    .insert(workspaces)
    // D160: premium, so every feature can be switched on as before plans.
    .values({
      unionId,
      slug,
      discordGuildId: String(unionId),
      leaderRoleIds: ["2"],
      plan: "premium",
    })
    .returning({ id: workspaces.id });
  const workspaceId = w?.id ?? 0;
  const [u] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `discord-${slug}`, displayName: `Officer ${slug}` })
    .returning({ id: workspaceUsers.id });
  const officer = u?.id ?? 0;
  await db.insert(workspaceSessions).values({
    tokenHash: `session-hash-${slug}`,
    workspaceId,
    workspaceUserId: officer,
    createdAt: SEED_AT,
    expiresAt: new Date(SEED_AT.getTime() + 86_400_000),
  });
  return { workspaceId, unionId, officer };
}

/** A KvK entry, its plan (D161) and a member's ask for a role (issue 831). */
async function seedKvkPlan(db: Db, ws: number, by: { createdBy: number; createdAt: Date }) {
  const kvk = id(
    await db
      .insert(calendarEntries)
      .values({ workspaceId: ws, kind: "kvk", day: DAY, minute: 720, ...by })
      .returning({ id: calendarEntries.id }),
  );
  const roles = [{ name: "Scout", uids: [101] }];
  await db.insert(kvkPlans).values({ workspaceId: ws, entryId: kvk, roles, rev: 1 });
  const asked = { workspaceId: ws, entryId: kvk, role: "Scout", uid: 102, askedAt: by.createdAt };
  await db.insert(kvkClaims).values(asked);
}

/** A row in every table the workspace owns (the squads rows need `seedRoster`'s daily read first). */
export async function seedEverything(
  db: Db,
  { workspaceId: ws, unionId, officer }: { workspaceId: number; unionId: number; officer: number },
) {
  const by = { createdBy: officer, createdAt: SEED_AT };
  // #832: the alliance's glossary.
  await db
    .insert(workspaceGlossary)
    .values({ workspaceId: ws, words: ["[ZZZ]"], updatedAt: SEED_AT });
  const gone = { deletedAt: SEED_AT, deletedBy: officer, deleteRequestId: `gone-${ws}` };
  await db.insert(memberFacts).values({
    workspaceId: ws,
    uid: 101,
    field: "notes",
    version: 1,
    value: "Kind and steady",
    source: "officer",
    writtenBy: officer,
    writtenAt: SEED_AT,
  });
  // D154: what a member sent about themselves (here the officer's own link, the one user seeded).
  await db.insert(memberSelfReports).values({
    workspaceId: ws,
    userId: officer,
    uid: 101,
    field: "timeZone",
    value: "Europe/Lisbon",
    version: 1,
    requestId: `self-${ws}`,
    writtenAt: SEED_AT,
  });
  await db.insert(pendingMembers).values([
    { workspaceId: ws, name: "Brin New", nameKey: "brin new", ...by },
    { workspaceId: ws, name: "Cale Gone", nameKey: "cale gone", ...by, ...gone },
  ]);
  await db
    .insert(nameAliases)
    .values({ workspaceId: ws, nameKey: "ana", uid: 101, confirmedAt: SEED_AT });
  const entry = id(
    await db
      .insert(calendarEntries)
      .values([
        { workspaceId: ws, kind: "undead", level: 5, day: DAY, minute: 600, ...by },
        { workspaceId: ws, kind: "other", title: "Old plan", day: DAY, minute: 60, ...by, ...gone },
      ])
      .returning({ id: calendarEntries.id }),
  );
  await db
    .insert(calendarOccurrences)
    .values({ workspaceId: ws, entryId: entry, week: WEEK, cancelled: true });
  await db
    .insert(garrisonPlans)
    .values({ workspaceId: ws, entryId: entry, week: WEEK, enemyMight: 1000 });
  await seedKvkPlan(db, ws, by);
  await seedNotices(db, ws, officer);
  await seedCallsAndThefts(db, ws, officer);
  const share = id(
    await db
      .insert(thanksShares)
      .values({
        workspaceId: ws,
        requestId: `thanks-${ws}`,
        target: "board",
        week: WEEK,
        texts: { en: "Thank you all" },
        names: ["Ana Example"],
        status: "posted",
        sharedAt: SEED_AT,
      })
      .returning({ id: thanksShares.id }),
  );
  await db.insert(thanksTakedowns).values({ shareId: share, takenAt: SEED_AT });
  await db.insert(startHere).values({
    workspaceId: ws,
    texts: { en: { glossary: "Words", rules: "Be kind", ask: "Ask us" } },
  });
  await seedImports(db, ws);
  await seedKeyAndData(db, ws, unionId, officer);
  await seedRecruitReads(db, ws);
  await seedRaid(db, ws, officer);
}
