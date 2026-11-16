// notices and notice_edits (issue 304): a workspace's notices with each field's newest edit, and a save in
// one transaction. The save locks the notice's row, so two officers saving the same notice at once are
// taken one after the other and the second sees the first one's versions. What a save may write is
// decided in lib/private (`decide`), which sees the current values under that lock.
import { and, desc, eq } from "drizzle-orm";
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

/** The newest edit of each field, for one notice or for every notice of the workspace. */
function newestFields(db: Pick<Db, "selectDistinctOn">, workspaceId: number, noticeId?: number) {
  return db
    .selectDistinctOn([noticeEdits.noticeId, noticeEdits.field], {
      noticeId: noticeEdits.noticeId,
      field: noticeEdits.field,
      version: noticeEdits.id,
      value: noticeEdits.value,
      basis: noticeEdits.basis,
      by: workspaceUsers.displayName,
      at: noticeEdits.editedAt,
    })
    .from(noticeEdits)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticeEdits.editedBy))
    .where(
      and(
        eq(noticeEdits.workspaceId, workspaceId),
        noticeId === undefined ? undefined : eq(noticeEdits.noticeId, noticeId),
      ),
    )
    .orderBy(noticeEdits.noticeId, noticeEdits.field, desc(noticeEdits.id));
}

export async function workspaceNotices(db: Db, workspaceId: number): Promise<NoticeRecord[]> {
  const [rows, fields] = await Promise.all([
    noticeRows(db, workspaceId),
    newestFields(db, workspaceId),
  ]);
  return rows.map((row) => ({
    ...row,
    fields: fields.filter((f) => f.noticeId === row.id),
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
  const { workspaceId, noticeId, userId, now } = target;
  return db.transaction(async (tx) => {
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
            })
            .returning({ id: notices.id })
        : [{ id: noticeId }];
    if (!made) return null;
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
