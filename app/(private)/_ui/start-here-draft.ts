// Start here's draft (D105, D116), pure: the three parts per language as the officer has them, the saved text
// and version of each language, the drafts Translate and Improve writing filled (for Accept and Undo), and
// "Keep as is". Same behaviour as the notices' draft (notice-draft.ts), on Start here's own data: a language
// is "may be out of date" when another written language was saved later (each language's version is the
// save that last wrote it). A translation is saved together with the language it came from, so both carry
// the same version and neither reads as out of date; "Keep as is" saves a language unchanged for the same
// reason.
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/private/start-here";

import { planTranslate, type TabState } from "./notice-draft";

export type Part = keyof StartHereText;
export type Texts = Record<NoticeLanguage, StartHereText>;
export const PARTS: Part[] = ["glossary", "rules", "ask"];

export interface ShDraft {
  values: Texts;
  /** The saved text, which `versions` refer to. */
  base: Texts;
  versions: Record<NoticeLanguage, number>;
  /** The text before Translate or Improve writing filled it, for Undo. */
  undo: Partial<Record<NoticeLanguage, StartHereText>>;
  /** Filled by Translate from this language, until the save. */
  from: Partial<Record<NoticeLanguage, NoticeLanguage>>;
  /** The parts a draft filled, so the editor marks them. */
  parts: Partial<Record<NoticeLanguage, Part[]>>;
  partly: Partial<Record<NoticeLanguage, true>>;
  kept: Partial<Record<NoticeLanguage, true>>;
}

export const written = (x: StartHereText) => PARTS.some((p) => x[p].trim() !== "");
const same = (a: StartHereText, b: StartHereText) => PARTS.every((p) => a[p] === b[p]);
const omit = <T extends object>(record: T, key: PropertyKey): T =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)) as T;

export function startShDraft(texts: Texts, versions: Record<NoticeLanguage, number>): ShDraft {
  return {
    values: texts,
    base: texts,
    versions,
    undo: {},
    from: {},
    parts: {},
    partly: {},
    kept: {},
  };
}

/** The saved language written last (the first in EN, PT, FR order on a tie), or null when none is written. */
export function newestSaved(d: ShDraft): NoticeLanguage | null {
  const saved = NOTICE_LANGUAGES.filter((l) => written(d.base[l]));
  return saved.reduce<NoticeLanguage | null>(
    (best, l) => (best === null || d.versions[l] > d.versions[best] ? l : best),
    null,
  );
}

/** A written language saved before the newest one: its text may be behind. */
export function staleSaved(d: ShDraft, language: NoticeLanguage): boolean {
  const newest = newestSaved(d);
  return newest !== null && written(d.base[language]) && d.versions[language] < d.versions[newest];
}

export function shTabState(d: ShDraft, language: NoticeLanguage): TabState {
  if (d.undo[language] !== undefined) return "draft";
  if (staleSaved(d, language) && !d.kept[language] && same(d.values[language], d.base[language]))
    return "stale";
  return written(d.values[language]) ? "written" : "empty";
}

export function shDraftKind(d: ShDraft, language: NoticeLanguage): "translate" | "improve" | null {
  if (d.undo[language] === undefined) return null;
  return d.from[language] ? "translate" : "improve";
}

/** What Translate does from the active tab: the notices' rule (planTranslate). */
export function shTranslatePlan(
  d: ShDraft,
  active: NoticeLanguage,
  languages: readonly NoticeLanguage[],
  wroteIn: NoticeLanguage | null,
) {
  return planTranslate({
    active,
    languages,
    wroteIn,
    has: (l) => written(d.values[l]),
    translation: shDraftKind(d, active) === "translate",
    source: d.from[active],
  });
}

/**
 * Translate or Improve writing put `drafts` in (each language's new parts): each language keeps its text
 * from before for Undo, and is marked when it came back partly untranslated.
 */
export function withShDrafts(
  d: ShDraft,
  drafts: Partial<Record<NoticeLanguage, Partial<StartHereText>>>,
  from: NoticeLanguage | null,
  partly: NoticeLanguage[] = [],
): ShDraft {
  const next = { ...d, values: { ...d.values }, undo: { ...d.undo }, parts: { ...d.parts } };
  for (const [language, parts] of Object.entries(drafts) as [
    NoticeLanguage,
    Partial<StartHereText>,
  ][]) {
    next.undo[language] = d.undo[language] ?? d.values[language];
    next.values[language] = { ...d.values[language], ...parts };
    next.parts[language] = PARTS.filter((p) => p in parts);
    next.from = from ? { ...next.from, [language]: from } : omit(next.from, language);
    next.partly = partly.includes(language)
      ? { ...next.partly, [language]: true }
      : omit(next.partly, language);
  }
  // The language translated from is now a source, not a translation.
  if (from) next.from = omit(next.from, from);
  return next;
}

/** Accept: the text stays (a translation keeps its source until the save). */
export const shAccept = (d: ShDraft, language: NoticeLanguage): ShDraft => ({
  ...d,
  undo: omit(d.undo, language),
  parts: omit(d.parts, language),
  partly: omit(d.partly, language),
});

/** Undo: the text from before the draft comes back. */
export const shUndo = (d: ShDraft, language: NoticeLanguage): ShDraft => ({
  ...d,
  values: { ...d.values, [language]: d.undo[language] ?? d.values[language] },
  undo: omit(d.undo, language),
  parts: omit(d.parts, language),
  partly: omit(d.partly, language),
  from: omit(d.from, language),
});

export const shKeep = (d: ShDraft, language: NoticeLanguage): ShDraft => ({
  ...d,
  kept: { ...d.kept, [language]: true },
});

export const shSet = (
  d: ShDraft,
  language: NoticeLanguage,
  part: Part,
  value: string,
): ShDraft => ({
  ...d,
  values: { ...d.values, [language]: { ...d.values[language], [part]: value } },
});

/**
 * The languages changed or kept, and what goes along so they share one version: the source of each
 * translation, and, when a language is kept or translated, every saved language that is up to date now (at
 * the newest version). A language edited by hand and saved alone goes alone, so the others read as behind.
 */
export function shChanges(d: ShDraft): NoticeLanguage[] {
  const changed = NOTICE_LANGUAGES.filter(
    (l) => !same(d.values[l], d.base[l]) || d.kept[l] === true,
  );
  const newest = newestSaved(d);
  const current = NOTICE_LANGUAGES.filter(
    (l) => newest !== null && written(d.base[l]) && d.versions[l] === d.versions[newest],
  );
  const along = changed.flatMap((l) => {
    const source = d.from[l];
    const joined = d.kept[l] || source ? current : [];
    return source ? [...joined, source] : joined;
  });
  return NOTICE_LANGUAGES.filter((l) => changed.includes(l) || along.includes(l));
}

/** The nine texts as one flat record ("en.glossary", …), the shape kept on the device (notice-keep.ts). */
export type ShField = `${NoticeLanguage}.${Part}`;
export const SH_FIELDS: ShField[] = NOTICE_LANGUAGES.flatMap((l) =>
  PARTS.map((p): ShField => `${l}.${p}`),
);
export const flatTexts = (texts: Texts): Record<ShField, string> =>
  Object.fromEntries(
    NOTICE_LANGUAGES.flatMap((l) => PARTS.map((p) => [`${l}.${p}`, texts[l][p]])),
  ) as Record<ShField, string>;
export function textsOf(flat: Record<ShField, string>): Texts {
  const one = (l: NoticeLanguage) => ({
    glossary: flat[`${l}.glossary`],
    rules: flat[`${l}.rules`],
    ask: flat[`${l}.ask`],
  });
  return { en: one("en"), "pt-BR": one("pt-BR"), fr: one("fr") };
}

/** The text differs from the saved one somewhere (Cancel asks first; Sign out asks first). */
export const shDirty = (d: ShDraft) => NOTICE_LANGUAGES.some((l) => !same(d.values[l], d.base[l]));

/** After a save of `languages` at `version`: they are the saved text now. */
export function shSaved(d: ShDraft, languages: NoticeLanguage[], version: number): ShDraft {
  let next = { ...d, base: { ...d.base }, versions: { ...d.versions } };
  for (const l of languages) {
    next.base[l] = d.values[l];
    next.versions[l] = version;
    next = {
      ...next,
      kept: omit(next.kept, l),
      from: omit(next.from, l),
      undo: omit(next.undo, l),
      parts: omit(next.parts, l),
      partly: omit(next.partly, l),
    };
  }
  return next;
}
