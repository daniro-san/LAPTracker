// The member-facts editor's form (issue 297, D80), pure: the fields as typed, filled from the stored facts
// or from what "Paste what they told you" found, and the field-level changes a save sends, each with the
// version it was based on and its source ("from a message" until the officer edits it).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import {
  LANGUAGES,
  type FactField,
  type FactSource,
  type FactValues,
  type MemberFacts,
  type OfficerStatus,
} from "@/lib/private/fact-fields";
import type { OnboardingFacts } from "@/lib/private/onboarding-parse";

import { SHEET_KEYS } from "./sheet-words";

export interface Form {
  squadMight: string;
  adTech: string;
  troopTier: string;
  timeZone: string;
  languages: string[];
  status: "" | OfficerStatus;
  awayText: string;
  awayFrom: string;
  awayUntil: string;
  notes: string;
}

/** The words the editor, the paste box and the time-zone picker use, sent to the client once. */
export const EDITOR_KEYS = [
  ...SHEET_KEYS,
  "facts.head",
  "facts.squadMight",
  "facts.adTech",
  "facts.troopTier",
  "facts.timeZone",
  "facts.languages",
  "facts.status",
  "facts.away",
  "facts.notes",
  "facts.edit",
  "facts.paste",
  "facts.title",
  "facts.save",
  "facts.failed",
  "facts.computed",
  "facts.awayText",
  "facts.awayFrom",
  "facts.awayDay",
  "facts.mightHint",
  "facts.adHint",
  "facts.conflictBar",
  "facts.conflictField",
  "facts.mergedLine",
  "facts.theirs",
  "facts.mine",
  "facts.until",
  "facts.awayRange",
  "facts.awayOrder",
  "status.break",
  "status.help",
  "src.message",
  "src.officer",
  "src.sheet",
  "src.unsaved",
  "paste.help",
  "paste.read",
  "paste.nothing",
  "paste.found.one",
  "paste.found.other",
  "paste.zones",
  "shot.read",
  "shot.reading",
  "shot.failed",
  "shot.busy",
  "shot.notKept",
  "tz.choose",
  "tz.search",
  "tz.searchAria",
  "tz.theirTime",
  "tz.st",
  "tz.more",
  "tz.none",
  "tz.now",
  "pending.add",
  "pending.addHelp",
  "pending.name",
  "pending.nameMissing",
  "pending.taken",
  "pending.open",
  "pending.addAnyway",
  "pending.takenWhy",
] as const;
export type EditorWords = Pick<WorkspaceDictionary, (typeof EDITOR_KEYS)[number]>;

export const editorWords = (t: WorkspaceDictionary): EditorWords =>
  Object.fromEntries(EDITOR_KEYS.map((k) => [k, t[k]])) as EditorWords;

/** "Paste updates" on Members (D109): its sheet's words, sent to the client once. */
const UPDATES_KEYS = [
  ...SHEET_KEYS,
  "updates.open",
  "updates.help",
  "updates.after",
  "updates.read",
  "updates.nothing",
  "updates.failed",
  "shot.read",
  "shot.reading",
  "shot.failed",
  "shot.busy",
  "shot.notKept",
] as const;
export type UpdatesWords = Pick<WorkspaceDictionary, (typeof UPDATES_KEYS)[number]>;

export const updatesWords = (t: WorkspaceDictionary): UpdatesWords =>
  Object.fromEntries(UPDATES_KEYS.map((k) => [k, t[k]])) as UpdatesWords;
/** The import screen's words (SheetImport), sent to the client once. */
export const IMPORT_KEYS = [
  "import.paste",
  "import.file",
  "import.check",
  "import.noName",
  "import.tooMany",
  "import.columns",
  "import.ignored",
  "import.summary",
  "import.isIt",
  "import.someone",
  "import.dismiss",
  "import.dismissAll",
  "import.change",
  "import.matched",
  "import.role",
  "import.zone",
  "import.apply",
  "import.left",
  "import.saved.one",
  "import.saved.other",
  "import.for.one",
  "import.for.other",
  "import.skipped.one",
  "import.skipped.other",
  "import.back",
  "import.choose",
  "import.fill.one",
  "import.fill.other",
  "import.stay.one",
  "import.stay.other",
  "import.failed",
  "import.again",
  "sheet.name",
  "sheet.rank",
  "facts.squadMight",
  "facts.adTech",
  "facts.troopTier",
  "facts.timeZone",
  "src.sheet",
] as const;
export type ImportWords = Pick<WorkspaceDictionary, (typeof IMPORT_KEYS)[number]>;

export const importWords = (t: WorkspaceDictionary): ImportWords =>
  Object.fromEntries(IMPORT_KEYS.map((k) => [k, t[k]])) as ImportWords;

/** What went wrong reading a sheet, as words: no "Name" column, too many rows, anything else. */
export const IMPORT_PROBLEM = {
  noName: "import.noName",
  tooMany: "import.tooMany",
  failed: "import.failed",
} as const satisfies Record<string, keyof ImportWords>;

/** A sheet column's label, by what it fills (lib/private/sheet-parse.ts). */
export const COLUMN_LABEL = {
  name: "sheet.name",
  role: "sheet.rank",
  squadMight: "facts.squadMight",
  adTech: "facts.adTech",
  troopTier: "facts.troopTier",
  timeZone: "facts.timeZone",
} as const satisfies Record<string, keyof ImportWords>;

/** The singular or plural form of a counted phrase (`key.one` / `key.other`), by the language's rule. */
export const counted = (
  words: Readonly<Record<string, string>>,
  key: string,
  n: number,
  language: string,
): string =>
  words[`${key}.${new Intl.PluralRules(language).select(n) === "one" ? "one" : "other"}`] ?? "";

/** lib/copy's `fill` for client components, which do not load lib/copy (the public pages' words). */
export const say = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => String(values[key] ?? all));

export const SOURCE_KEY = {
  message: "src.message",
  officer: "src.officer",
  sheet: "src.sheet",
} as const satisfies Record<FactSource, keyof EditorWords>;

/** 69.5 as "69.5" in English, "69,5" in Portuguese and French. */
const decimal = (n: number, language: string) =>
  String(n).replace(".", language === "en" ? "." : ",");
const text = (s: string | null | undefined) => s ?? "";

export function formOf(facts: MemberFacts, language: string): Form {
  const v = <F extends FactField>(f: F) => (facts[f]?.value ?? null) as FactValues[F] | null;
  const number = (n: number | null, as: (n: number) => string) => (n === null ? "" : as(n));
  const away = v("away");
  return {
    squadMight: number(v("squadMight"), (n) => new Intl.NumberFormat(language).format(n)),
    adTech: number(v("adTech"), (n) => decimal(n, language)),
    troopTier: number(v("troopTier"), String),
    timeZone: text(v("timeZone")),
    languages: v("languages") ?? [],
    status: v("status") ?? "",
    awayText: text(away?.text),
    awayFrom: text(away?.from),
    awayUntil: text(away?.until),
    notes: text(v("notes")),
  };
}

/** The form's inputs each fact fills. */
const INPUTS: Record<FactField, (keyof Form)[]> = {
  squadMight: ["squadMight"],
  adTech: ["adTech"],
  troopTier: ["troopTier"],
  timeZone: ["timeZone"],
  languages: ["languages"],
  status: ["status"],
  away: ["awayText", "awayFrom", "awayUntil"],
  notes: ["notes"],
};

/** The inputs of one field, from a stored fact (another officer's newer value). */
export function inputsOf(field: FactField, facts: MemberFacts, language: string): Partial<Form> {
  const all = formOf(facts, language);
  return Object.fromEntries(INPUTS[field].map((k) => [k, all[k]]));
}

/** What a paste found, written into the form; returns the fields it filled. */
export function propose(form: Form, found: OnboardingFacts, language: string): [Form, FactField[]] {
  const next = { ...form };
  const filled: FactField[] = [];
  if (found.squadMight !== null) {
    next.squadMight = new Intl.NumberFormat(language).format(found.squadMight);
    filled.push("squadMight");
  }
  if (found.adTech !== null) {
    next.adTech = decimal(found.adTech, language);
    filled.push("adTech");
  }
  if (found.timeZones[0]) {
    next.timeZone = found.timeZones[0];
    filled.push("timeZone");
  }
  if (found.languages.length > 0) {
    next.languages = [...new Set([...form.languages, ...found.languages])];
    filled.push("languages");
  }
  return [next, filled];
}

type Value = FactValues[FactField] | null;

const blank = (s: string) => s.trim() === "";

/** "69", "69,5", "69.5", "69%": 0–100; undefined when it is not one, or above 100. */
export function percentOf(typed: string): number | null | undefined {
  const s = typed.replace("%", "").trim();
  if (s === "") return null;
  const n = /^\d+([.,]\d*)?$/.test(s) ? Number(s.replace(",", ".")) : NaN;
  return n <= 100 ? n : undefined;
}

/**
 * The away note as typed; null when nothing is, undefined when the first day is after the last (D103).
 * The first day is kept only when given; the server sets it to the day of the save otherwise.
 */
function awayOf(form: Form): FactValues["away"] | null | undefined {
  const text = form.awayText.trim();
  if (!text && !form.awayFrom && !form.awayUntil) return null;
  if (form.awayFrom && form.awayUntil && form.awayFrom > form.awayUntil) return undefined;
  return { text, ...(form.awayFrom && { from: form.awayFrom }), until: form.awayUntil || null };
}

/** Two away notes as the same note: field by field, a missing first day read as none. */
const sameAway = (a: unknown, b: unknown) => {
  const key = (v: unknown) => {
    const n = v as FactValues["away"] | null;
    return n ? [n.text, n.from ?? null, n.until ?? null].join("\u0000") : null;
  };
  return key(a) === key(b);
};

/** Whether a field's value is the stored one (an away note field by field). */
const unchanged = (field: FactField, stored: unknown, value: unknown) =>
  field === "away" ? sameAway(stored, value) : JSON.stringify(stored) === JSON.stringify(value);

/** Each field's value from the form; `undefined` when what was typed is not a value. */
export function valuesOf(
  form: Form,
  readMight: (text: string) => number | null,
): { [F in FactField]: FactValues[F] | null | undefined } {
  return {
    squadMight: blank(form.squadMight) ? null : (readMight(form.squadMight) ?? undefined),
    adTech: percentOf(form.adTech),
    troopTier: form.troopTier === "" ? null : Number(form.troopTier),
    timeZone: form.timeZone || null,
    languages:
      form.languages.length > 0 ? LANGUAGES.filter((l) => form.languages.includes(l)) : null,
    status: form.status || null,
    away: awayOf(form),
    notes: form.notes.trim() || null,
  };
}

export interface Change {
  field: FactField;
  version: number;
  value: Value;
  source: "message" | "officer";
}

/** The fields whose value differs from the stored one, as changes; and the fields typed wrongly. */
export function changesOf(
  values: ReturnType<typeof valuesOf>,
  facts: MemberFacts,
  fromMessage: ReadonlySet<FactField>,
): { changes: Change[]; invalid: FactField[] } {
  const entries = Object.entries(values) as [FactField, Value | undefined][];
  const invalid = entries.filter(([, v]) => v === undefined).map(([field]) => field);
  const changes = entries.flatMap(([field, value]) => {
    const stored = facts[field];
    if (value === undefined || unchanged(field, stored?.value ?? null, value)) return [];
    const source = fromMessage.has(field) ? ("message" as const) : ("officer" as const);
    return [{ field, version: stored?.version ?? 0, value, source }];
  });
  return { changes, invalid };
}
