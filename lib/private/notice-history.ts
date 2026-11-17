// A notice's earlier versions (issue 345, D102): notice_edits is append-only, one row per saved field, and
// one save writes its rows with one time and one officer, so a version is one save. The editor lists them
// newest first, with what each changed and the text it replaced, and can put any of them back as a draft.
// Pure and browser-safe: `versionsOf` runs on the server (notices.ts reads the rows), `before` and
// `fieldsAt` in the editor.
import type { EditRow } from "../repo/notices";
import { NOTICE_FIELDS, type NoticeField } from "./notice-rules";

export interface NoticeVersion {
  /** The save's newest edit id. */
  id: number;
  by: string | null;
  at: Date;
  changes: { field: NoticeField; value: string }[];
}

/** One save per run of rows with the same time and officer; fields in the editor's order. */
export function versionsOf(rows: readonly EditRow[]): NoticeVersion[] {
  const versions: NoticeVersion[] = [];
  for (const row of rows) {
    const last = versions.at(-1);
    const change = { field: row.field as NoticeField, value: row.value };
    if (last && last.at.getTime() === row.at.getTime() && last.by === row.by) {
      last.changes.push(change);
    } else versions.push({ id: row.id, by: row.by, at: row.at, changes: [change] });
  }
  const order = (f: NoticeField) => NOTICE_FIELDS.indexOf(f);
  for (const v of versions) v.changes.sort((a, b) => order(a.field) - order(b.field));
  return versions;
}

/** The field's value before version `index` changed it; null when no older one is listed. */
export function before(
  versions: readonly Pick<NoticeVersion, "changes">[],
  index: number,
  field: NoticeField,
): string | null {
  for (const v of versions.slice(index + 1)) {
    const found = v.changes.find((c) => c.field === field);
    if (found) return found.value;
  }
  return null;
}

/** Each field as it stood after version `index`; a field with no listed value is left out. */
export function fieldsAt(
  versions: readonly Pick<NoticeVersion, "changes">[],
  index: number,
): Partial<Record<NoticeField, string>> {
  const out: Partial<Record<NoticeField, string>> = {};
  for (const v of versions.slice(index)) {
    for (const c of v.changes) if (!(c.field in out)) out[c.field] = c.value;
  }
  return out;
}
