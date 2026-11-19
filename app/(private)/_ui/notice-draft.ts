// The notice editor's draft (issue 304), pure: what the officer has typed, the versions the save names, which
// languages Translate or Improve writing filled (for Accept, Undo and the translation's source), a conflict's
// two answers, and what each language tab shows and what Translate does from it (issue 363).
import {
  isNoticeLanguage,
  NOTICE_FIELDS,
  NOTICE_LIMIT,
  noticeLength,
  type Change,
  type NoticeField,
  type NoticeLanguage,
} from "@/lib/private/notice-rules";

import type { Conflict, DraftAsk, NoticeFields } from "./notice-client";

type Values = Record<NoticeField, string>;

export interface Draft {
  values: Values;
  /** The values the versions refer to: a field differs from it when the officer changed it. */
  base: Values;
  versions: Record<NoticeField, number>;
  /** Filled by Translate: the language and the text it was made from. */
  from: Partial<Record<NoticeLanguage, { language: NoticeLanguage; text: string }>>;
  /** The text before Translate or Improve writing filled it, for Undo. */
  undo: Partial<Record<NoticeLanguage, string>>;
  /** "Keep as is" on a language that may be out of date: saved unchanged, which brings it up to date. */
  kept: Partial<Record<NoticeLanguage, true>>;
  /** A translation that came back partly untranslated even after its retry (D81). */
  partly: Partial<Record<NoticeLanguage, true>>;
  /** Filled from an earlier version ("Restore this version", D102). */
  restored: Partial<Record<NoticeLanguage, true>>;
  /** Filled by "Fit to 1,000" (D113). */
  /**
   * Filled by "Fit to 1,000" (D113). `keepsSource`: Fit shortened an accepted translation, so Undo brings
   * that translation back with its source, and the save keeps the source's basis.
   */
  fitted: Partial<Record<NoticeLanguage, { keepsSource: boolean }>>;
}

export const omit = <T extends object>(record: T, key: PropertyKey): T =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)) as T;

export function startDraft(fields: NoticeFields): Draft {
  const values = Object.fromEntries(
    NOTICE_FIELDS.map((f) => [
      f,
      f === "for_members" ? fields[f].value || "false" : fields[f].value,
    ]),
  ) as Values;
  const versions = Object.fromEntries(NOTICE_FIELDS.map((f) => [f, fields[f].version]));
  const draft = { values, base: values, versions: versions as Draft["versions"] };
  return { ...draft, from: {}, undo: {}, kept: {}, partly: {}, restored: {}, fitted: {} };
}

const changed = (d: Draft, f: NoticeField) =>
  d.values[f] !== d.base[f] || (isNoticeLanguage(f) && d.kept[f] === true);

/**
 * The changed fields (and the kept ones), each with its version; a translation names its source when that
 * text is unchanged.
 */
export function changesOf(d: Draft): Change[] {
  return NOTICE_FIELDS.filter((f) => changed(d, f)).map((field) => {
    const source = isNoticeLanguage(field) ? d.from[field] : undefined;
    const from =
      source && d.values[source.language] === source.text
        ? { language: source.language, version: d.versions[source.language] }
        : undefined;
    return { field, value: d.values[field], version: d.versions[field], ...(from && { from }) };
  });
}

/**
 * Translate or Improve writing put `drafts` in: each language keeps its previous text for Undo, and is
 * marked when it came back partly untranslated.
 */
export function withDrafts(
  d: Draft,
  drafts: Partial<Record<NoticeLanguage, string>>,
  ask: DraftAsk,
  partly: NoticeLanguage[] = [],
): Draft {
  let next = { ...d, values: { ...d.values }, undo: { ...d.undo }, partly: { ...d.partly } };
  for (const [language, text] of Object.entries(drafts) as [NoticeLanguage, string][]) {
    next.undo[language] = d.undo[language] ?? d.values[language];
    next.restored = omit(next.restored, language);
    const keepsSource =
      d.fitted[language]?.keepsSource ??
      (d.undo[language] === undefined && d.from[language] !== undefined);
    next.fitted =
      ask.kind === "fit"
        ? { ...next.fitted, [language]: { keepsSource } }
        : omit(next.fitted, language);
    next.values[language] = text;
    next.partly = partly.includes(language)
      ? { ...next.partly, [language]: true }
      : omit(next.partly, language);
    // Fit on a fresh translation keeps its source, so the save keeps that language's basis (D113);
    // Fit on hand-written text, like Improve writing, makes it the officer's own.
    next.from =
      ask.kind === "translate"
        ? { ...next.from, [language]: { language: ask.from, text: ask.text } }
        : ask.kind === "fit"
          ? next.from
          : omit(next.from, language);
  }
  // The language translated from is now the source text, not a translation.
  if (ask.kind === "translate") next = { ...next, from: omit(next.from, ask.from) };
  return next;
}

/**
 * "Restore this version" (D102): each field as it stood then. A language that changes becomes a draft to
 * Accept or Undo, like a translation; the other fields simply take their earlier value.
 */
export function withRestored(d: Draft, earlier: Partial<Values>): Draft {
  const next = { ...d, values: { ...d.values }, undo: { ...d.undo }, restored: { ...d.restored } };
  for (const [field, value] of Object.entries(earlier) as [NoticeField, string][]) {
    if (next.values[field] === value) continue;
    if (isNoticeLanguage(field)) {
      next.undo[field] = d.undo[field] ?? d.values[field];
      next.restored[field] = true;
      next.from = omit(next.from, field);
      next.partly = omit(next.partly, field);
      next.fitted = omit(next.fitted, field);
    }
    next.values[field] = value;
  }
  return next;
}

/** Keep mine: only their version is taken. Use theirs: their value replaces mine. */
export function settle(d: Draft, c: Conflict, keep: "theirs" | "mine"): Draft {
  const next = {
    ...d,
    base: { ...d.base, [c.field]: c.value },
    versions: { ...d.versions, [c.field]: c.version },
  };
  if (keep === "mine") return next;
  return {
    ...next,
    values: { ...d.values, [c.field]: c.value },
    from: omit(d.from, c.field),
    undo: omit(d.undo, c.field),
    kept: omit(d.kept, c.field),
    restored: omit(d.restored, c.field),
    fitted: omit(d.fitted, c.field),
  };
}

/** Accept: the officer checked the draft; the text stays, and a translation keeps its source. */
export const accept = (d: Draft, language: NoticeLanguage): Draft => ({
  ...d,
  undo: omit(d.undo, language),
  partly: omit(d.partly, language),
  restored: omit(d.restored, language),
  fitted: omit(d.fitted, language),
});

/** Undo: the text from before the draft comes back. */
export const discard = (d: Draft, language: NoticeLanguage): Draft => ({
  ...d,
  values: { ...d.values, [language]: d.undo[language] ?? d.values[language] },
  undo: omit(d.undo, language),
  partly: omit(d.partly, language),
  // Undo of a Fit on an accepted translation brings that translation back, still linked to its source.
  from: d.fitted[language]?.keepsSource ? d.from : omit(d.from, language),
  restored: omit(d.restored, language),
  fitted: omit(d.fitted, language),
});

/**
 * The tab a Translate or Improve writing request was made from, where its error belongs: the language it
 * rewrites, the one tab it fills ("from EN", "Update from …"), else the language it translates from.
 */
export const askTab = (ask: DraftAsk): NoticeLanguage =>
  ask.kind !== "translate" ? ask.language : ask.to.length === 1 && ask.to[0] ? ask.to[0] : ask.from;

/** "Fit to 1,000" is offered on a tab only while its text is over the board's limit (D113). */
export const canFit = (d: Draft, language: NoticeLanguage): boolean =>
  // Trimmed, as the draft route counts it.
  noticeLength(d.values[language].trim()) > NOTICE_LIMIT;

/** What a language's tab shows (issue 363): a draft to check, may be out of date, written, or empty. */
export type TabState = "draft" | "stale" | "written" | "empty";

/** `staleSaved`: the server says the saved text may be out of date; a change or "Keep as is" clears it. */
export function tabState(d: Draft, language: NoticeLanguage, staleSaved: boolean): TabState {
  if (d.undo[language] !== undefined) return "draft";
  if (staleSaved && !d.kept[language] && d.values[language] === d.base[language]) return "stale";
  return d.values[language].trim() === "" ? "empty" : "written";
}

/** Which action filled the language's draft, or null when it holds none. */
export function draftKind(
  d: Draft,
  language: NoticeLanguage,
): "translate" | "improve" | "fit" | "restore" | null {
  if (d.undo[language] === undefined) return null;
  if (d.restored[language]) return "restore";
  if (d.fitted[language]) return "fit";
  return d.from[language] ? "translate" : "improve";
}

/**
 * What Translate does from the active tab: text the officer wrote (or rewrote) there goes to the other
 * languages. An empty tab, or one holding a draft from Translate, is filled from the text it came from,
 * else from the language the officer last wrote in, else from the first written one. Null: nothing to
 * translate.
 */
export function translatePlan(
  d: Draft,
  active: NoticeLanguage,
  languages: NoticeLanguage[],
  wroteIn: NoticeLanguage | null,
): { from: NoticeLanguage; to: NoticeLanguage[] } | null {
  const translation = draftKind(d, active) === "translate" || (d.fitted[active] && d.from[active]);
  return planTranslate({
    active,
    languages,
    wroteIn,
    has: (l) => d.values[l].trim() !== "",
    translation: Boolean(translation),
    source: d.from[active]?.language,
  });
}

/**
 * translatePlan's rule for any editor with one text per language (the notices) or several (Start here, D116):
 * `has` says whether a language holds text, `translation` whether the active tab holds a draft from
 * Translate, and `source` the language that draft came from.
 */
export function planTranslate(x: {
  active: NoticeLanguage;
  languages: readonly NoticeLanguage[];
  wroteIn: NoticeLanguage | null;
  has: (l: NoticeLanguage) => boolean;
  translation: boolean;
  source: NoticeLanguage | undefined;
}): { from: NoticeLanguage; to: NoticeLanguage[] } | null {
  const { active, has } = x;
  if (has(active) && !x.translation)
    return { from: active, to: x.languages.filter((l) => l !== active) };
  const from = [x.source, x.wroteIn, ...x.languages].find(
    (l): l is NoticeLanguage => l !== undefined && l !== null && l !== active && has(l),
  );
  return from ? { from, to: [active] } : null;
}
