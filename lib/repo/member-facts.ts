// member_facts and name_aliases (issue #297, D80): the plain reads and writes behind officer-edited member
// facts and the sheet import's remembered matches. Every function takes the workspace id; lib/private
// passes its WorkspaceAccess's own. Versions, merging and who may write stay in lib/private.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { memberFacts, nameAliases } from "../schema";

export interface FactRow {
  uid: number;
  field: string;
  version: number;
  value: unknown;
  source: "message" | "officer" | "sheet";
  writtenAt: Date;
}

const columns = {
  uid: memberFacts.uid,
  field: memberFacts.field,
  version: memberFacts.version,
  value: memberFacts.value,
  source: memberFacts.source,
  writtenAt: memberFacts.writtenAt,
};

/** The newest version of every field of every member of the workspace. */
export async function latestFacts(db: Db, workspaceId: number): Promise<FactRow[]> {
  return db
    .selectDistinctOn([memberFacts.uid, memberFacts.field], columns)
    .from(memberFacts)
    .where(eq(memberFacts.workspaceId, workspaceId))
    .orderBy(memberFacts.uid, memberFacts.field, desc(memberFacts.version));
}

/**
 * Every version of `fields` in the workspace (of one member when `uid` is given), oldest first per member
 * and field: the card's change since the previous version and the week's progress (D109).
 */
export async function factHistory(
  db: Db,
  workspaceId: number,
  fields: readonly string[],
  uid?: number,
): Promise<FactRow[]> {
  return db
    .select(columns)
    .from(memberFacts)
    .where(
      and(
        eq(memberFacts.workspaceId, workspaceId),
        inArray(memberFacts.field, [...fields]),
        uid === undefined ? undefined : eq(memberFacts.uid, uid),
      ),
    )
    .orderBy(memberFacts.uid, memberFacts.field, asc(memberFacts.version));
}

/** One field of one member: its newest version, or the version asked for; null when there is none. */
export async function factVersion(
  db: Db,
  workspaceId: number,
  uid: number,
  field: string,
  version: number | "newest",
): Promise<FactRow | null> {
  const [row] = await db
    .select(columns)
    .from(memberFacts)
    .where(
      and(
        eq(memberFacts.workspaceId, workspaceId),
        eq(memberFacts.uid, uid),
        eq(memberFacts.field, field),
        version === "newest" ? undefined : eq(memberFacts.version, version),
      ),
    )
    .orderBy(desc(memberFacts.version))
    .limit(1);
  return row ?? null;
}

/** Appends one version of a field; false when that version exists already (another write won). */
export async function insertFact(db: Db, row: typeof memberFacts.$inferInsert): Promise<boolean> {
  const added = await db
    .insert(memberFacts)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: memberFacts.id });
  return added.length > 0;
}

/** Appends many versions at once; a version that exists already is skipped. Returns how many were added. */
export async function insertFacts(
  db: Db,
  rows: readonly (typeof memberFacts.$inferInsert)[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const added = await db
    .insert(memberFacts)
    .values([...rows])
    .onConflictDoNothing()
    .returning({ id: memberFacts.id });
  return added.length;
}

/** The workspace's remembered sheet names: name key → uid, or null for "not a member". */
export async function aliasesOf(db: Db, workspaceId: number): Promise<Map<string, number | null>> {
  const rows = await db
    .select({ key: nameAliases.nameKey, uid: nameAliases.uid })
    .from(nameAliases)
    .where(eq(nameAliases.workspaceId, workspaceId));
  return new Map(rows.map((r) => [r.key, r.uid]));
}

/**
 * Remembers what a person decided for each name key; a later decision replaces an earlier one. A null
 * `confirmedBy` is a match the end-of-day roster made (D106).
 */
export async function saveAliases(
  db: Db,
  workspaceId: number,
  decided: readonly { nameKey: string; uid: number | null }[],
  confirmedBy: number | null,
  now: Date,
): Promise<void> {
  // One row per key: Postgres refuses to update the same row twice in one statement.
  const byKey = new Map(decided.map((d) => [d.nameKey, d.uid]));
  if (byKey.size === 0) return;
  await db
    .insert(nameAliases)
    .values(
      [...byKey].map(([nameKey, uid]) => ({
        workspaceId,
        nameKey,
        uid,
        confirmedBy,
        confirmedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [nameAliases.workspaceId, nameAliases.nameKey],
      set: {
        uid: sql`excluded.uid`,
        confirmedBy: sql`excluded.confirmed_by`,
        confirmedAt: sql`excluded.confirmed_at`,
      },
    });
}
