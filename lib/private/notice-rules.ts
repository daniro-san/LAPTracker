// The notices library's rules (issues 304, 293 and 305), pure, so the page's counter and the server share
// them: the fields, the counter, which languages may be out of date, and what a save writes.
//
// Out of date: each language's text carries a basis, the revision of the notice it reflects. A save that
// changes up-to-date text by hand starts a new revision, so the other languages fall behind. A translation
// takes the basis of the text it was made from. Saving a language that was behind (or empty) by hand
// catches it up instead of starting a revision, so "Keep as is" and a hand fix clear the marker.
import type { WorkspaceLanguage } from "./dictionary";

export const NOTICE_LANGUAGES = [
  "en",
  "pt-BR",
  "fr",
] as const satisfies readonly WorkspaceLanguage[];
export type NoticeLanguage = (typeof NOTICE_LANGUAGES)[number];

export const NOTICE_FIELDS = ["title", ...NOTICE_LANGUAGES, "for_members", "ends_on"] as const;
export type NoticeField = (typeof NOTICE_FIELDS)[number];

/** The in-game notice board's room (owner, issue 304). Over it is a soft warning, never a block. */
export const NOTICE_LIMIT = 1000;
/** The most Translate and Improve writing take in one request: three times the board's room (D81). */
export const DRAFT_LIMIT = 3000;

export const isNoticeLanguage = (field: string): field is NoticeLanguage =>
  (NOTICE_LANGUAGES as readonly string[]).includes(field);

const graphemes = new Intl.Segmenter();

/** Characters as a reader counts them: an emoji or an accented letter is one. */
export function noticeLength(text: string): number {
  const segments = graphemes.segment(text)[Symbol.iterator]();
  let n = 0;
  while (!segments.next().done) n++;
  return n;
}

/** A field's current value. `version` is the id of the edit that set it; 0 means never set. */
export interface FieldValue {
  version: number;
  value: string;
  basis: number | null;
}
export type NoticeState = Partial<Record<NoticeField, FieldValue>>;

const written = (state: NoticeState, language: NoticeLanguage) =>
  (state[language]?.value ?? "") !== "";

/** From the basis of each written language: the ones behind the newest, "may be out of date". */
export function staleOf(bases: Partial<Record<NoticeLanguage, number | null>>): NoticeLanguage[] {
  const languages = NOTICE_LANGUAGES.filter((l) => l in bases);
  const newest = Math.max(0, ...languages.map((l) => bases[l] ?? 0));
  return languages.filter((l) => (bases[l] ?? 0) < newest);
}

/** The languages with text that is behind the newest language's. */
export function staleLanguages(state: NoticeState): NoticeLanguage[] {
  return staleOf(
    Object.fromEntries(
      NOTICE_LANGUAGES.filter((l) => written(state, l)).map((l) => [l, state[l]?.basis ?? null]),
    ),
  );
}

/** One field as the officer saved it. */
export interface Change {
  field: NoticeField;
  value: string;
  /** The version the officer was looking at (0 when the field had none). */
  version: number;
  /** Filled by Translate: the language it came from and that language's version at the time. */
  from?: { language: NoticeLanguage; version: number } | undefined;
}

export interface NewEdit {
  field: NoticeField;
  value: string;
  basis: number | null;
}

export type SavePlan = { ok: true; edits: NewEdit[] } | { ok: false; conflicts: NoticeField[] };

/**
 * What a save writes. Any field changed since the officer's version refuses the whole save (409), so
 * nothing is overwritten silently (issue 293). Otherwise each language gets its basis.
 */
export function planSave(state: NoticeState, changes: readonly Change[]): SavePlan {
  const conflicts = changes
    .filter((c) => (state[c.field]?.version ?? 0) !== c.version)
    .map((c) => c.field);
  if (conflicts.length > 0) return { ok: false, conflicts };
  const behind = new Set(staleLanguages(state));
  const newest = Math.max(0, ...NOTICE_LANGUAGES.map((l) => state[l]?.basis ?? 0));
  const byHand = changes.filter((c) => isNoticeLanguage(c.field) && !c.from);
  const catchingUp = byHand.every((c) => {
    const language = c.field as NoticeLanguage;
    return behind.has(language) || !written(state, language);
  });
  const handBasis = catchingUp && newest > 0 ? newest : newest + 1;
  const basisOf = (c: Change): number | null => {
    if (!isNoticeLanguage(c.field)) return null;
    if (!c.from) return handBasis;
    // Translated from text saved in this same save: the same revision.
    if (changes.some((s) => s.field === c.from?.language)) return handBasis;
    const source = state[c.from.language];
    // Made from the text the source still has: its revision. From an older text: behind at once.
    return source && source.version === c.from.version ? (source.basis ?? 0) : 0;
  };
  return {
    ok: true,
    edits: changes.map((c) => ({ field: c.field, value: c.value, basis: basisOf(c) })),
  };
}
