"use client";

// Parts of the sheet import screen (issue 297, D80), split from SheetImport.tsx for its size: the columns
// read with one example each (as written → as stored), the matched rows, what an import would fill, and
// the result with a link back to Members.
import { buttonClass } from "@/lib/brand/components/Button";
import type { FactField, FactValues } from "@/lib/private/fact-fields";
import { dayFormat, factText } from "@/lib/private/fact-text";
import { fillPlan } from "@/lib/private/import-plan";
import type { ImportPreview, ImportResult, ImportRow } from "@/lib/private/sheet-import";

import { COLUMN_LABEL, counted, say, type ImportWords } from "./facts-form";

/** "First Squad → Main squad (10.7 → 10.7M)", in the officer's language. */
function columnText(
  column: ImportPreview["columns"][number],
  words: ImportWords,
  language: string,
) {
  const label = words[COLUMN_LABEL[column.field as keyof typeof COLUMN_LABEL]];
  if (!column.example) return `${column.header} → ${label}`;
  const format = {
    language,
    now: new Date(),
    day: dayFormat(language),
    words: { "status.break": "", "status.help": "", "facts.until": "" },
  };
  const value = factText(
    column.field as FactField,
    column.example.value as FactValues[FactField],
    format,
  );
  return `${column.header} → ${label} (${column.example.raw} → ${value})`;
}

/** Which columns the sheet's header gave, what each fills with an example, and the ones not imported. */
export function Columns(props: { preview: ImportPreview; words: ImportWords; language: string }) {
  const { preview, words } = props;
  const read = preview.columns.filter((c) => c.field !== null);
  const ignored = preview.columns.filter((c) => c.field === null && c.header.trim() !== "");
  return (
    <>
      <p className="text-body-sm">
        {say(words["import.columns"], {
          list: read.map((c) => columnText(c, words, props.language)).join(", "),
        })}
      </p>
      {ignored.length > 0 && (
        <p className="text-body-sm text-ink/75">
          {say(words["import.ignored"], { list: ignored.map((c) => c.header).join(", ") })}
        </p>
      )}
    </>
  );
}

export function Matched(props: { preview: ImportPreview; rows: ImportRow[]; words: ImportWords }) {
  const nameOf = (uid: number) => props.preview.members.find((m) => m.uid === uid)?.name ?? "";
  return (
    <details className="mt-3 border border-rule px-3 py-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
        {say(props.words["import.matched"], { n: props.rows.length })}
      </summary>
      <ul translate="no" className="text-body-sm">
        {props.rows.map((r) => (
          <li key={r.line} className="border-t border-rule py-2 break-words">
            <bdi>{r.name}</bdi> →{" "}
            <bdi>{r.match.status === "matched" ? nameOf(r.match.uid) : ""}</bdi>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** "Will fill 12 empty fields. 3 fields already have a value and stay as they are." */
export function FillCount(props: {
  preview: ImportPreview;
  /** A row's answer: a member, null for "not a member"; absent while open. */
  answers: Map<number, number | null>;
  words: ImportWords;
  language: string;
}) {
  const { preview, answers, words, language } = props;
  const uidOf = (r: ImportRow) =>
    r.match.status === "matched" ? r.match.uid : (answers.get(r.line) ?? null);
  const has = (uid: number, field: string) => preview.filled[uid]?.includes(field) ?? false;
  const { fill, kept } = fillPlan(preview.rows, uidOf, has);
  return (
    <p className="text-body-sm">
      {say(counted(words, "import.fill", fill.length, language), { n: fill.length })}
      {kept > 0 && ` ${say(counted(words, "import.stay", kept, language), { m: kept })}`}
    </p>
  );
}

/** "Saved 12 values for 5 members. 3 values were skipped because the members already had one." */
export function Done(props: {
  result: ImportResult;
  words: ImportWords;
  language: string;
  slug: string;
  onAgain: () => void;
}) {
  const { words, language, result } = props;
  const line = [
    say(counted(words, "import.saved", result.saved, language), { n: result.saved }),
    say(counted(words, "import.for", result.members, language), { m: result.members }),
    ...(result.kept > 0
      ? [say(counted(words, "import.skipped", result.kept, language), { k: result.kept })]
      : []),
  ].join(" ");
  return (
    <div className="mt-4 border border-rule px-4 py-4">
      <p>{line}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={`/w/${props.slug}/members`} className={buttonClass("primary")}>
          {words["import.back"]}
        </a>
        <button type="button" onClick={props.onAgain} className={buttonClass("secondary")}>
          {words["import.again"]}
        </button>
      </div>
    </div>
  );
}
