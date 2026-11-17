// calendar_entries and calendar_occurrences (issue 300): plain reads and writes, each inside one workspace.
// What a change means, its version check and its words stay in lib/private.
import { and, eq, gte, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { calendarEntries, calendarOccurrences, workspaceUsers } from "../schema";

type EntryRow = typeof calendarEntries.$inferSelect;
type OccurrenceRow = typeof calendarOccurrences.$inferSelect;
/** A connection or a transaction. */
export type Tx = Pick<Db, "select" | "insert" | "update" | "delete">;

/**
 * Every entry and per-week row the days from `from` to `to` can show: entries that start by `to` and
 * still run in `week0` (the Monday of `from`) or later, rows of those weeks or moved into those days, and
 * the entries of rows moved in from other weeks.
 */
export async function calendarRows(
  db: Db,
  workspaceId: number,
  week0: string,
  from: string,
  to: string,
): Promise<{ entries: EntryRow[]; rows: OccurrenceRow[] }> {
  const [entries, rows] = await Promise.all([
    db
      .select()
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.workspaceId, workspaceId),
          lte(calendarEntries.day, to),
          or(isNull(calendarEntries.lastWeek), gte(calendarEntries.lastWeek, week0)),
        ),
      ),
    db
      .select()
      .from(calendarOccurrences)
      .where(
        and(
          eq(calendarOccurrences.workspaceId, workspaceId),
          or(
            and(gte(calendarOccurrences.week, week0), lte(calendarOccurrences.week, to)),
            and(gte(calendarOccurrences.day, from), lte(calendarOccurrences.day, to)),
          ),
        ),
      ),
  ]);
  const known = entries.map((e) => e.id);
  const missing = [...new Set(rows.map((r) => r.entryId))].filter((id) => !known.includes(id));
  if (missing.length === 0) return { entries, rows };
  const more = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.workspaceId, workspaceId),
        inArray(calendarEntries.id, missing),
        known.length > 0 ? notInArray(calendarEntries.id, known) : undefined,
      ),
    );
  return { entries: [...entries, ...more], rows };
}

/**
 * A new entry's id; null when its request id is already stored (D100): a send that arrived at the same
 * moment won the unique index, and the caller answers with that entry instead.
 */
export async function insertEntry(
  db: Db,
  values: typeof calendarEntries.$inferInsert,
): Promise<number | null> {
  const [row] = await db
    .insert(calendarEntries)
    .values(values)
    .onConflictDoNothing({ target: [calendarEntries.workspaceId, calendarEntries.requestId] })
    .returning({ id: calendarEntries.id });
  return row?.id ?? null;
}

/** The entry an add with this request id made (D100), if one did. */
export async function findByRequest(
  db: Db,
  workspaceId: number,
  requestId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(
      and(eq(calendarEntries.workspaceId, workspaceId), eq(calendarEntries.requestId, requestId)),
    );
  return row?.id ?? null;
}

/** The week's Alliance Duel theme entry, if one exists. */
export async function findTheme(
  db: Db,
  workspaceId: number,
  monday: string,
): Promise<number | null> {
  const [row] = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.workspaceId, workspaceId),
        eq(calendarEntries.kind, "duel"),
        eq(calendarEntries.day, monday),
      ),
    );
  return row?.id ?? null;
}

export async function findEntry(tx: Tx, workspaceId: number, id: number, lock = false) {
  const query = tx
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.workspaceId, workspaceId), eq(calendarEntries.id, id)));
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

/** The entry's row for `week`, made empty first when there is none, and locked. */
export async function lockWeekRow(
  tx: Tx,
  workspaceId: number,
  entryId: number,
  week: string,
): Promise<OccurrenceRow> {
  await tx
    .insert(calendarOccurrences)
    .values({ workspaceId, entryId, week })
    .onConflictDoNothing({ target: [calendarOccurrences.entryId, calendarOccurrences.week] });
  const [row] = await tx
    .select()
    .from(calendarOccurrences)
    .where(
      and(
        eq(calendarOccurrences.workspaceId, workspaceId),
        eq(calendarOccurrences.entryId, entryId),
        eq(calendarOccurrences.week, week),
      ),
    )
    .for("update");
  return row as OccurrenceRow;
}

export async function updateEntry(
  tx: Tx,
  id: number,
  set: Partial<typeof calendarEntries.$inferInsert>,
): Promise<void> {
  await tx.update(calendarEntries).set(set).where(eq(calendarEntries.id, id));
}

export async function updateWeekRow(
  tx: Tx,
  id: number,
  set: Partial<typeof calendarOccurrences.$inferInsert>,
): Promise<void> {
  await tx.update(calendarOccurrences).set(set).where(eq(calendarOccurrences.id, id));
}

export async function deleteEntry(db: Db, workspaceId: number, id: number): Promise<void> {
  await db
    .delete(calendarEntries)
    .where(and(eq(calendarEntries.workspaceId, workspaceId), eq(calendarEntries.id, id)));
}

/** The shown name of each of these officers of the workspace: the chosen one, else the Discord one. */
export async function officerNames(
  db: Db,
  workspaceId: number,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: workspaceUsers.id,
      name: sql<
        string | null
      >`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
    })
    .from(workspaceUsers)
    .where(and(eq(workspaceUsers.workspaceId, workspaceId), inArray(workspaceUsers.id, ids)));
  return new Map(rows.flatMap((r) => (r.name ? [[r.id, r.name] as const] : [])));
}

/** Every Alliance Caravan week of the workspace with a seat taken: who sat, and where the week falls. */
export async function caravanSeats(db: Db, workspaceId: number) {
  return db
    .select({
      entryId: calendarOccurrences.entryId,
      week: calendarOccurrences.week,
      movedTo: calendarOccurrences.day,
      planned: calendarEntries.day,
      coachUid: calendarOccurrences.coachUid,
      secondUid: calendarOccurrences.secondUid,
    })
    .from(calendarOccurrences)
    .innerJoin(calendarEntries, eq(calendarEntries.id, calendarOccurrences.entryId))
    .where(
      and(
        eq(calendarOccurrences.workspaceId, workspaceId),
        eq(calendarEntries.kind, "caravan"),
        eq(calendarOccurrences.cancelled, false),
        or(isNotNull(calendarOccurrences.coachUid), isNotNull(calendarOccurrences.secondUid)),
      ),
    );
}

/** The entries linked to one notice (D102). */
export async function entriesOfNotice(db: Db, workspaceId: number, noticeId: number) {
  return db
    .select()
    .from(calendarEntries)
    .where(
      and(eq(calendarEntries.workspaceId, workspaceId), eq(calendarEntries.noticeId, noticeId)),
    );
}
