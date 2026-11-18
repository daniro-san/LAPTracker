// The notices library (issue 304): every notice of the workspace, one notice with each field's version,
// and a save. Every read and write takes the WorkspaceAccess, so a notice is reached only from its own
// workspace (D71); every officer of it reads and edits all of them. The text is the officers' own: no roster
// field is read here.
import { z } from "zod";

import type { Db } from "../db";
import { markNoticeDeleted, unmarkNoticeDeleted } from "../repo/notice-deletes";
import {
  HISTORY_LIMIT,
  noticeEditRows,
  noticeTitles,
  workspaceNotice,
  workspaceNoticeList,
  writeNotice,
  type FieldRow,
  type NoticeListRow,
} from "../repo/notices";
import type { WorkspaceAccess } from "./access";
import { versionsOf, type NoticeVersion } from "./notice-history";
import {
  isNoticeLanguage,
  NOTICE_FIELDS,
  NOTICE_LANGUAGES,
  planSave,
  staleLanguages,
  staleOf,
  type Change,
  type NoticeField,
  type NoticeLanguage,
  type NoticeState,
} from "./notice-rules";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** What each field may hold. Languages may be emptied; the counter's limit is a warning, this is a cap. */
const VALID: Record<NoticeField, (value: string) => boolean> = {
  title: (v) => v.trim() !== "" && v.length <= 200,
  en: (v) => v.length <= 8000,
  "pt-BR": (v) => v.length <= 8000,
  fr: (v) => v.length <= 8000,
  for_members: (v) => v === "true" || v === "false",
  ends_on: (v) => v === "" || isDay(v),
};

const change = z
  .object({
    field: z.enum(NOTICE_FIELDS),
    value: z.string(),
    version: z.number().int().min(0),
    from: z
      .object({ language: z.enum(NOTICE_LANGUAGES), version: z.number().int().min(0) })
      .strict()
      .optional(),
  })
  .strict()
  .refine((c) => VALID[c.field](c.value))
  .refine((c) => !c.from || (isNoticeLanguage(c.field) && c.from.language !== c.field));

/** A save's body: the notice (none for a new one) and each changed field once. */
export const noticeSave = z
  .object({
    id: z.number().int().positive().optional(),
    changes: z.array(change).min(1).max(NOTICE_FIELDS.length),
    /** A new notice's request id (D100), made once per open editor. */
    requestId: z.uuid().optional(),
    /** Saved from a review request (D113): the save closes it as edited, under the editor's request id. */
    review: z.object({ id: z.number().int().positive(), requestId: z.uuid() }).strict().optional(),
  })
  .strict()
  .refine((s) => s.review === undefined || s.id !== undefined)
  .refine((s) => new Set(s.changes.map((c) => c.field)).size === s.changes.length)
  // INVARIANT notices.request-once: a new notice carries its request id, so a retry stores one notice.
  .refine((s) => (s.id === undefined) === (s.requestId !== undefined));

export interface NoticeSummary {
  id: number;
  title: string;
  /** Each language: written or not, and whether it may be out of date. */
  languages: { language: NoticeLanguage; written: boolean; stale: boolean }[];
  forMembers: boolean;
  endsOn: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface NoticeDetail extends NoticeSummary {
  createdAt: Date;
  createdBy: string | null;
  fields: Record<NoticeField, { value: string; version: number }>;
  stale: NoticeLanguage[];
}

const stateOf = (rows: FieldRow[]): NoticeState =>
  Object.fromEntries(rows.map((r) => [r.field, r]));

/** A card's words from the list's fields: the title, the flags, and each language written or behind. */
function summaryOf(row: NoticeListRow): NoticeSummary {
  const value = (field: NoticeField) => row.fields.find((f) => f.field === field)?.value ?? "";
  const bases = Object.fromEntries(
    row.fields.filter((f) => isNoticeLanguage(f.field) && f.written).map((f) => [f.field, f.basis]),
  );
  const stale = staleOf(bases);
  return {
    id: row.id,
    title: value("title"),
    languages: NOTICE_LANGUAGES.map((language) => ({
      language,
      written: language in bases,
      stale: stale.includes(language),
    })),
    forMembers: value("for_members") === "true",
    endsOn: value("ends_on") || null,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/** The titles of these notices by id, for the calendar entries linked to them (D102). */
export const titlesOf = (db: Db, access: WorkspaceAccess, ids: number[]) =>
  noticeTitles(db, access.workspaceId, [...new Set(ids)]);

/** The library: at most LIST_LIMIT notices, without their text. */
export async function noticesList(db: Db, access: WorkspaceAccess): Promise<NoticeSummary[]> {
  return (await workspaceNoticeList(db, access.workspaceId)).map(summaryOf);
}

export async function noticeDetail(
  db: Db,
  access: WorkspaceAccess,
  id: number,
): Promise<NoticeDetail | null> {
  const record = await workspaceNotice(db, access.workspaceId, id);
  if (!record) return null;
  const state = stateOf(record.fields);
  const fields = record.fields.map((f) => ({ ...f, written: f.value !== "" }));
  return {
    ...summaryOf({ ...record, fields }),
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    fields: Object.fromEntries(
      NOTICE_FIELDS.map((f) => [
        f,
        { value: state[f]?.value ?? "", version: state[f]?.version ?? 0 },
      ]),
    ) as NoticeDetail["fields"],
    stale: staleLanguages(state),
  };
}

/** The notice's saves, newest first, for the editor's "Earlier versions" (D102). */
export async function noticeHistory(
  db: Db,
  access: WorkspaceAccess,
  id: number,
): Promise<{ versions: NoticeVersion[]; cut: number | undefined }> {
  const rows = await noticeEditRows(db, access.workspaceId, id);
  return {
    versions: versionsOf(rows),
    cut: rows.length === HISTORY_LIMIT ? HISTORY_LIMIT : undefined,
  };
}

/** How long the officer who deleted a notice may still take it back (D118); the page offers it for less. */
export const UNDO_MS = 60_000;

/** A delete's body (D118): the notice and the delete sheet's request id (D100); `undo` takes it back. */
export const noticeDelete = z
  .object({
    id: z.number().int().positive(),
    requestId: z.uuid(),
    undo: z.literal(true).optional(),
  })
  .strict();

/**
 * Deletes a notice of the workspace (D118), or undoes the officer's own delete made under the same request
 * id in the last UNDO_MS. "not_found": no such notice to delete, or nothing of this officer's to undo.
 */
export async function deleteNotice(
  db: Db,
  access: WorkspaceAccess,
  input: z.infer<typeof noticeDelete>,
  now: Date,
): Promise<"ok" | "not_found"> {
  const d = {
    workspaceId: access.workspaceId,
    id: input.id,
    userId: access.user.id,
    requestId: input.requestId,
    now,
  };
  const done = input.undo
    ? await unmarkNoticeDeleted(db, d, new Date(now.getTime() - UNDO_MS))
    : await markNoticeDeleted(db, d);
  return done ? "ok" : "not_found";
}

/** A field someone else saved after the version the officer was looking at. */
export interface Conflict {
  field: NoticeField;
  value: string;
  version: number;
  by: string | null;
  at: Date;
}

export type SaveResult =
  | { ok: true; id: number }
  | { ok: false; reason: "not_found" | "no_title" }
  | { ok: false; reason: "conflict"; conflicts: Conflict[] };

/** Saves `changes` to notice `id`, or makes a new notice when `id` is null (it needs a title). */
export async function saveNotice(
  db: Db,
  access: WorkspaceAccess,
  id: number | null,
  changes: Change[],
  now: Date,
  /** A new notice's request id (D100); a retry with it answers the first notice's id. */
  requestId: string | null = null,
  /** Runs in the save's transaction after the edits (D113: closes the review request it came from). */
  after?: (tx: Pick<Db, "select" | "insert">, id: number) => Promise<unknown>,
): Promise<SaveResult> {
  if (id === null && !changes.some((c) => c.field === "title")) {
    return { ok: false, reason: "no_title" };
  }
  const target = {
    workspaceId: access.workspaceId,
    noticeId: id,
    userId: access.user.id,
    now,
    requestId,
  };
  const result = await writeNotice(
    db,
    target,
    (current) => {
      const plan = planSave(stateOf(current), changes);
      if (plan.ok) return { write: plan.edits };
      const conflicts = plan.conflicts.map((field): Conflict => {
        const row = current.find((r) => r.field === field);
        return {
          field,
          value: row?.value ?? "",
          version: row?.version ?? 0,
          by: row?.by ?? null,
          at: row?.at ?? now,
        };
      });
      return { refuse: conflicts };
    },
    after,
  );
  if (result === null) return { ok: false, reason: "not_found" };
  if ("refuse" in result) return { ok: false, reason: "conflict", conflicts: result.refuse };
  return { ok: true, id: result.id };
}
