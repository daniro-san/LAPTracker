// notices and notice_edits (issue 304): the library's list (no text, at most LIST_LIMIT notices), one notice
// with each field's newest edit, and a save in one transaction. The save locks the notice's row, so two officers saving the same notice at once are
// taken one after the other and the second sees the first one's versions. What a save may write is
// decided in lib/private (`decide`), which sees the current values under that lock.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { noticeEdits, notices } from "../schema-notices";

/** A field's newest edit: its id is the field's version. */
export interface FieldRow {
  field: string;
  version: number;
  value: string;
  basis: number | null;
  by: string | null;
  at: Date;
}

export interface NoticeRecord {
  id: number;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  fields: FieldRow[];
}

const creator = alias(workspaceUsers, "creator");
const updater = alias(workspaceUsers, "updater");

/** A workspace's notices (one, with `id`), the most recently changed first, without their fields. */
function noticeRows(db: Db, workspaceId: number, id?: number) {
  return db
    .select({
      id: notices.id,
      createdAt: notices.createdAt,
      createdBy: creator.displayName,
      updatedAt: notices.updatedAt,
      updatedBy: updater.displayName,
    })
    .from(notices)
    .leftJoin(creator, eq(creator.id, notices.createdBy))
    .leftJoin(updater, eq(updater.id, notices.updatedBy))
    .where(
      and(eq(notices.workspaceId, workspaceId), id === undefined ? undefined : eq(notices.id, id)),
    )
    .orderBy(desc(notices.updatedAt), desc(notices.id));
}

/** The newest edit of each field of one notice. */
function newestFields(db: Pick<Db, "selectDistinctOn">, workspaceId: number, noticeId: number) {
  return db
    .selectDistinctOn([noticeEdits.field], {
      field: noticeEdits.field,
      version: noticeEdits.id,
      value: noticeEdits.value,
      basis: noticeEdits.basis,
      by: workspaceUsers.displayName,
      at: noticeEdits.editedAt,
    })
    .from(noticeEdits)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticeEdits.editedBy))
    .where(and(eq(noticeEdits.workspaceId, workspaceId), eq(noticeEdits.noticeId, noticeId)))
    .orderBy(noticeEdits.field, desc(noticeEdits.id));
}

/** The library shows this many notices, the most recently changed first. */
export const LIST_LIMIT = 200;

/** A field as the list needs it: a language's text stays in the database, only whether it is written. */
export interface ListField {
  field: string;
  /** null for a language. */
  value: string | null;
  written: boolean;
  basis: number | null;
}

export interface NoticeListRow {
  id: number;
  updatedAt: Date;
  updatedBy: string | null;
  fields: ListField[];
}

export async function workspaceNoticeList(db: Db, workspaceId: number): Promise<NoticeListRow[]> {
  const rows = await noticeRows(db, workspaceId).limit(LIST_LIMIT);
  if (rows.length === 0) return [];
  const fields = await db
    .selectDistinctOn([noticeEdits.noticeId, noticeEdits.field], {
      noticeId: noticeEdits.noticeId,
      field: noticeEdits.field,
      // The three language fields of notice_edits_field_check: their text is not read here.
      value: sql<
        string | null
      >`case when ${noticeEdits.field} in ('en', 'pt-BR', 'fr') then null else ${noticeEdits.value} end`,
      written: sql<boolean>`${noticeEdits.value} <> ''`,
      basis: noticeEdits.basis,
    })
    .from(noticeEdits)
    .where(
      and(
        eq(noticeEdits.workspaceId, workspaceId),
        inArray(
          noticeEdits.noticeId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(noticeEdits.noticeId, noticeEdits.field, desc(noticeEdits.id));
  return rows.map(({ id, updatedAt, updatedBy }) => ({
    id,
    updatedAt,
    updatedBy,
    fields: fields.filter((f) => f.noticeId === id),
  }));
}

export async function workspaceNotice(
  db: Db,
  workspaceId: number,
  id: number,
): Promise<NoticeRecord | null> {
  const [[row], fields] = await Promise.all([
    noticeRows(db, workspaceId, id),
    newestFields(db, workspaceId, id),
  ]);
  return row ? { ...row, fields } : null;
}

/** The editor's "Earlier versions" read this many of a notice's newest edits (D102). */
export const HISTORY_LIMIT = 300;

export interface EditRow {
  id: number;
  field: string;
  value: string;
  by: string | null;
  at: Date;
}

/** A notice's newest edits, newest first, with who made each (D102). */
export function noticeEditRows(db: Db, workspaceId: number, noticeId: number): Promise<EditRow[]> {
  return db
    .select({
      id: noticeEdits.id,
      field: noticeEdits.field,
      value: noticeEdits.value,
      by: workspaceUsers.displayName,
      at: noticeEdits.editedAt,
    })
    .from(noticeEdits)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticeEdits.editedBy))
    .where(and(eq(noticeEdits.workspaceId, workspaceId), eq(noticeEdits.noticeId, noticeId)))
    .orderBy(desc(noticeEdits.id))
    .limit(HISTORY_LIMIT);
}

/** The current title of each of these notices of the workspace, by id (D102: the calendar's links). */
export async function noticeTitles(
  db: Db,
  workspaceId: number,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([noticeEdits.noticeId], {
      id: noticeEdits.noticeId,
      title: noticeEdits.value,
    })
    .from(noticeEdits)
    .where(
      and(
        eq(noticeEdits.workspaceId, workspaceId),
        inArray(noticeEdits.noticeId, ids),
        eq(noticeEdits.field, "title"),
      ),
    )
    .orderBy(noticeEdits.noticeId, desc(noticeEdits.id));
  return new Map(rows.map((r) => [r.id, r.title]));
}

/** Whether the workspace has this notice: a calendar entry may link only its own workspace's (D102). */
export async function noticeInWorkspace(db: Db, workspaceId: number, id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(eq(notices.workspaceId, workspaceId), eq(notices.id, id)));
  return row !== undefined;
}

export interface NewEditRow {
  field: string;
  value: string;
  basis: number | null;
}

export interface NoticeWrite {
  workspaceId: number;
  /** null: a new notice. */
  noticeId: number | null;
  userId: number;
  now: Date;
  /** A new notice's request id (D100): when a notice already carries it, that notice is the answer. */
  requestId: string | null;
}

/**
 * One save. `decide` sees the notice's current fields (none for a new notice) and returns the edits to
 * write, or a refusal that is returned as it is and writes nothing. null: no such notice in the workspace.
 */
export async function writeNotice<R>(
  db: Db,
  target: NoticeWrite,
  decide: (current: FieldRow[]) => { write: NewEditRow[] } | { refuse: R },
): Promise<{ id: number } | { refuse: R } | null> {
  const { workspaceId, noticeId, userId, now, requestId } = target;
  return db.transaction(async (tx) => {
    // The notice a new notice's request id already made (D100): the answer when the insert below finds it.
    const requested = async () => {
      if (requestId === null) return null;
      const [made] = await tx
        .select({ id: notices.id })
        .from(notices)
        .where(and(eq(notices.workspaceId, workspaceId), eq(notices.requestId, requestId)));
      return made ? { id: made.id } : null;
    };
    if (noticeId !== null) {
      const [locked] = await tx
        .select({ id: notices.id })
        .from(notices)
        .where(and(eq(notices.id, noticeId), eq(notices.workspaceId, workspaceId)))
        .for("update");
      if (!locked) return null;
    }
    const current = noticeId === null ? [] : await newestFields(tx, workspaceId, noticeId);
    const decision = decide(current);
    if ("refuse" in decision) return decision;
    const [made] =
      noticeId === null
        ? await tx
            .insert(notices)
            .values({
              workspaceId,
              createdBy: userId,
              createdAt: now,
              updatedBy: userId,
              updatedAt: now,
              requestId,
            })
            .onConflictDoNothing({ target: [notices.workspaceId, notices.requestId] })
            .returning({ id: notices.id })
        : [{ id: noticeId }];
    // A send with the same request id came first (a retry, or one at the same moment) and holds the unique
    // index: its notice is the answer, and nothing of this one is written.
    if (!made) return requested();
    const id = made.id;
    await tx.insert(noticeEdits).values(
      decision.write.map((e) => ({
        ...e,
        noticeId: id,
        workspaceId,
        editedBy: userId,
        editedAt: now,
      })),
    );
    await tx.update(notices).set({ updatedBy: userId, updatedAt: now }).where(eq(notices.id, id));
    return { id };
  });
}

/**
 * The newest value of each of `fields` for the workspace's notices (only `ids`, when given), with each
 * notice's last change: the members' board (D105) first reads `for_members` and `ends_on` of every notice,
 * then the text of only those it shows.
 */
export async function newestNoticeValues(
  db: Db,
  workspaceId: number,
  fields: readonly string[],
  ids?: readonly number[],
): Promise<{ noticeId: number; field: string; value: string; updatedAt: Date }[]> {
  if (ids?.length === 0) return [];
  return db
    .selectDistinctOn([noticeEdits.noticeId, noticeEdits.field], {
      noticeId: noticeEdits.noticeId,
      field: noticeEdits.field,
      value: noticeEdits.value,
      updatedAt: notices.updatedAt,
    })
    .from(noticeEdits)
    .innerJoin(notices, eq(notices.id, noticeEdits.noticeId))
    .where(
      and(
        eq(noticeEdits.workspaceId, workspaceId),
        inArray(noticeEdits.field, [...fields]),
        ids ? inArray(noticeEdits.noticeId, [...ids]) : undefined,
      ),
    )
    .orderBy(noticeEdits.noticeId, noticeEdits.field, desc(noticeEdits.id));
}
