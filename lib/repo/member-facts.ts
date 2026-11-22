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
  source: "message" | "officer" | "sheet" | "tracker" | "member";
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

/**
 * A raw statement's fact row: Postgres sends a bigint as a string, and a time as a Date or a string. The
 * value goes through the jsonb column's own decoder, as Drizzle's selects do, so a raw read gives the
 * values factHistory and factVersion give.
 */
interface RawFact extends Record<string, unknown> {
  uid: string | number;
  field: string;
  version: number;
  value: unknown;
  source: FactRow["source"];
  written_at: Date | string;
}

const factOf = (r: RawFact): FactRow => ({
  uid: Number(r.uid),
  field: r.field,
  version: r.version,
  value: memberFacts.value.mapFromDriverValue(r.value),
  source: r.source,
  writtenAt: new Date(r.written_at),
});

/**
 * The newest version of every field of every member of the workspace, by member and field. One index
 * descent per (member, field) on `member_facts_version_unique`, walked backwards: the row before the last
 * pair's is the newest version of the pair before it. So the read grows with the pairs (about 7 a member),
 * not with the versions, which the tracker adds nightly (issue 521, D149).
 */
export async function latestFacts(db: Db, workspaceId: number): Promise<FactRow[]> {
  const result = await db.execute<RawFact>(sql`
    with recursive newest as (
      (select uid, field, version, value, source, written_at from member_facts
       where workspace_id = ${workspaceId}
       order by uid desc, field desc, version desc limit 1)
      union all
      select n.* from newest p cross join lateral (
        select f.uid, f.field, f.version, f.value, f.source, f.written_at from member_facts f
        where f.workspace_id = ${workspaceId} and (f.uid, f.field) < (p.uid, p.field)
        order by f.uid desc, f.field desc, f.version desc limit 1
      ) n
    )
    select * from newest order by uid, field`);
  return result.rows.map(factOf);
}

/**
 * Every version of `fields` in the workspace (of one member when `uid` is given), oldest first per member
 * and field: the card's change since the previous version (D109). The week's progress reads
 * factHistorySince.
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

/**
 * The versions of `fields` written from `since` on, and for each member and field among them the newest
 * version written before `since`, ordered as factHistory: what the week's progress compares when the week
 * starts after `since` (D109). The window goes through `member_facts_workspace_written_idx`, the version
 * before it through one descent per pair, so the read grows with one week's saves, not with the history
 * (issue 521, D149).
 */
export async function factHistorySince(
  db: Db,
  workspaceId: number,
  fields: readonly string[],
  since: Date,
): Promise<FactRow[]> {
  const at = since.toISOString();
  const result = await db.execute<RawFact>(sql`
    with recent as (
      select uid, field, version, value, source, written_at from member_facts
      where workspace_id = ${workspaceId} and written_at >= ${at}::timestamptz
        and field in (${sql.join(
          fields.map((f) => sql`${f}`),
          sql`, `,
        )})
    )
    select * from recent
    union all
    select b.* from (select distinct uid, field from recent) p cross join lateral (
      select f.uid, f.field, f.version, f.value, f.source, f.written_at from member_facts f
      where f.workspace_id = ${workspaceId} and f.uid = p.uid and f.field = p.field
        and f.written_at < ${at}::timestamptz
      order by f.version desc limit 1
    ) b
    order by uid, field, version`);
  return result.rows.map(factOf);
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
