// "Start here" for officers (D105): the record's read for its editor and its save. Each language is one field
// of issue 293's rule: a save names the version of each language it changes, and a language someone saved
// since is refused (409) with who saved it and when; two officers changing different languages both keep
// their change. Officers write it; members only read it, through lib/private/board.ts.
import { z } from "zod";

import type { Db } from "../db";
import { officerNames } from "../repo/calendar";
import { readStartHere, writeStartHere } from "../repo/start-here";
import type { StartHereText } from "../schema-board";
import type { WorkspaceAccess } from "./access";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "./notice-rules";

/** Caps per part: about a page each, which the board shows in full. */
export const START_HERE_MAX = { glossary: 4000, rules: 3000, ask: 1500 } as const;

const text = z
  .object({
    glossary: z.string().max(START_HERE_MAX.glossary),
    rules: z.string().max(START_HERE_MAX.rules),
    ask: z.string().max(START_HERE_MAX.ask),
  })
  .strict();

/** A save's body: each changed language once, with the version the officer was looking at. */
export const startHereSave = z
  .object({
    changes: z
      .array(
        z
          .object({
            language: z.enum(NOTICE_LANGUAGES),
            version: z.number().int().min(0),
            text,
          })
          .strict(),
      )
      .min(1)
      .max(NOTICE_LANGUAGES.length),
  })
  .strict()
  .refine((s) => new Set(s.changes.map((c) => c.language)).size === s.changes.length);
export type StartHereSave = z.infer<typeof startHereSave>;

export const EMPTY_TEXT: StartHereText = { glossary: "", rules: "", ask: "" };

export interface StartHereEdit {
  texts: Record<NoticeLanguage, StartHereText>;
  versions: Record<NoticeLanguage, number>;
  /** Who saved last and when (ISO), or null before the first save. */
  saved: { by: string | null; at: string } | null;
}

/** A language someone saved after the version the officer was looking at. */
export interface StartHereConflict {
  language: NoticeLanguage;
  by: string | null;
  at: string;
}

export async function startHereEdit(db: Db, access: WorkspaceAccess): Promise<StartHereEdit> {
  const row = await readStartHere(db, access.workspaceId);
  const names = await officerNames(db, access.workspaceId, row?.updatedBy ? [row.updatedBy] : []);
  const each = <T>(f: (l: NoticeLanguage) => T) =>
    Object.fromEntries(NOTICE_LANGUAGES.map((l) => [l, f(l)])) as Record<NoticeLanguage, T>;
  return {
    texts: each((l) => ({ ...EMPTY_TEXT, ...row?.texts[l] })),
    versions: each((l) => row?.edits[l]?.v ?? 0),
    saved:
      row && row.rev > 0
        ? {
            by: row.updatedBy ? (names.get(row.updatedBy) ?? null) : null,
            at: row.updatedAt.toISOString(),
          }
        : null,
  };
}

export async function saveStartHere(
  db: Db,
  access: WorkspaceAccess,
  save: StartHereSave,
  now: Date,
): Promise<{ ok: true; version: number } | { ok: false; conflicts: StartHereConflict[] }> {
  const by = { userId: access.user.id, now };
  const result = await writeStartHere(db, access.workspaceId, by, (row) => {
    // INVARIANT start-here.versions: a language saved since the officer looked is never overwritten.
    const stale = save.changes.filter((c) => (row.edits[c.language]?.v ?? 0) !== c.version);
    if (stale.length > 0)
      return { refuse: stale.map((c) => ({ ...c, edit: row.edits[c.language] })) };
    const rev = row.rev + 1;
    const texts = { ...row.texts };
    const edits = { ...row.edits };
    for (const c of save.changes) {
      texts[c.language] = {
        glossary: c.text.glossary.trim(),
        rules: c.text.rules.trim(),
        ask: c.text.ask.trim(),
      };
      edits[c.language] = { v: rev, by: access.user.id, at: now.toISOString() };
    }
    return { write: { texts, edits, rev } };
  });
  if ("ok" in result) return { ok: true, version: result.version };
  const ids = result.refuse.flatMap((c) => (c.edit?.by ? [c.edit.by] : []));
  const names = await officerNames(db, access.workspaceId, ids);
  return {
    ok: false,
    conflicts: result.refuse.map((c) => ({
      language: c.language,
      by: c.edit?.by ? (names.get(c.edit.by) ?? null) : null,
      at: c.edit?.at ?? now.toISOString(),
    })),
  };
}
