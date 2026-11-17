// The notice editor's draft (issue 304), pure: what the officer has typed, the versions the save names, which
// languages Translate or Improve writing filled (for Undo and the translation's source), and a conflict's
// two answers.
import {
  isNoticeLanguage,
  NOTICE_FIELDS,
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
  return { ...draft, from: {}, undo: {}, kept: {} };
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

/** Translate or Improve writing put `drafts` in: each language keeps its previous text for Undo. */
export function withDrafts(
  d: Draft,
  drafts: Partial<Record<NoticeLanguage, string>>,
  ask: DraftAsk,
): Draft {
  let next = { ...d, values: { ...d.values }, undo: { ...d.undo } };
  for (const [language, text] of Object.entries(drafts) as [NoticeLanguage, string][]) {
    next.undo[language] = d.undo[language] ?? d.values[language];
    next.values[language] = text;
    next.from =
      ask.kind === "translate"
        ? { ...next.from, [language]: { language: ask.from, text: ask.text } }
        : omit(next.from, language);
  }
  // The language translated from is now the source text, not a translation.
  if (ask.kind === "translate") next = { ...next, from: omit(next.from, ask.from) };
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
  };
}
