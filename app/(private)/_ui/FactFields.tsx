"use client";

// The member-facts editor's inputs (issue 297, D80), one row per field with its label and, when it has a
// value, where it came from: "from a message" for a value the paste box found, else the stored source.
// Every control is 44 px or more; nothing is hover-only.
import { useMemo, type ReactNode } from "react";

import { LANGUAGES, TIER_MAX, type FactField, type MemberFacts } from "@/lib/private/fact-fields";

import { SOURCE_KEY, type EditorWords, type Form } from "./facts-form";
import { SourceBadge } from "./SourceBadge";
import { TimeZonePicker } from "./TimeZonePicker";

export interface FieldsProps {
  form: Form;
  edit: (field: FactField, patch: Partial<Form>) => void;
  stored: MemberFacts;
  fromMessage: ReadonlySet<FactField>;
  invalid: readonly FactField[];
  /** Other zones the paste named, offered as one-tap swaps. */
  zones: readonly string[];
  words: EditorWords;
  language: string;
  serverZone: string;
  used: readonly string[];
  /** Under a field: another officer's newer value and the two answers. */
  conflictOf: (field: FactField) => ReactNode;
}

const INPUT = "min-h-11 w-full border border-rule bg-paper px-3";

function Row(props: FieldsProps & { field: FactField; children: ReactNode }) {
  const { field, words, stored, fromMessage } = props;
  const source = fromMessage.has(field)
    ? "message"
    : stored[field]?.value != null
      ? (stored[field]?.source ?? null)
      : null;
  return (
    <div className="border-t border-rule py-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span id={`fact-${field}`} className="font-semibold">
          {words[`facts.${field}`]}
        </span>
        {source && <SourceBadge source={source} label={words[SOURCE_KEY[source]]} />}
      </div>
      {props.children}
      {props.invalid.includes(field) && field === "squadMight" && (
        <p className="mt-1 text-body-sm text-seal">{words["facts.mightHint"]}</p>
      )}
      {props.conflictOf(field)}
    </div>
  );
}

function Numbers(p: FieldsProps) {
  const { form, edit, words, invalid } = p;
  return (
    <>
      <Row {...p} field="squadMight">
        <input
          aria-labelledby="fact-squadMight"
          inputMode="decimal"
          value={form.squadMight}
          aria-invalid={invalid.includes("squadMight") || undefined}
          placeholder={words["facts.mightHint"]}
          onChange={(e) => edit("squadMight", { squadMight: e.target.value })}
          className={INPUT}
        />
      </Row>
      <Row {...p} field="adTech">
        <span className="flex items-center gap-2">
          <input
            aria-labelledby="fact-adTech"
            inputMode="decimal"
            value={form.adTech}
            aria-invalid={invalid.includes("adTech") || undefined}
            onChange={(e) => edit("adTech", { adTech: e.target.value })}
            className={`${INPUT} max-w-28`}
          />
          <span aria-hidden="true">%</span>
        </span>
      </Row>
      <Row {...p} field="troopTier">
        <select
          aria-labelledby="fact-troopTier"
          value={form.troopTier}
          onChange={(e) => edit("troopTier", { troopTier: e.target.value })}
          className={`${INPUT} max-w-28`}
        >
          <option value="">—</option>
          {Array.from({ length: TIER_MAX }, (_, i) => (
            <option key={i} value={String(i + 1)}>{`T${i + 1}`}</option>
          ))}
        </select>
      </Row>
    </>
  );
}

function Zone(p: FieldsProps) {
  const { form, edit, zones } = p;
  return (
    <Row {...p} field="timeZone">
      <TimeZonePicker
        value={form.timeZone}
        onChange={(timeZone) => edit("timeZone", { timeZone })}
        words={p.words}
        language={p.language}
        serverZone={p.serverZone}
        used={p.used}
        labelledBy="fact-timeZone"
      />
      {zones.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm">
          <span>{p.words["paste.zones"]}</span>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => edit("timeZone", { timeZone: z })}
              className="min-h-11 border border-rule px-3"
            >
              {z.replaceAll("_", " ")}
            </button>
          ))}
        </p>
      )}
    </Row>
  );
}

function Languages(p: FieldsProps) {
  const { form, edit, language } = p;
  const names = useMemo(() => new Intl.DisplayNames([language], { type: "language" }), [language]);
  const toggle = (code: string) =>
    edit("languages", {
      languages: form.languages.includes(code)
        ? form.languages.filter((l) => l !== code)
        : [...form.languages, code],
    });
  return (
    <Row {...p} field="languages">
      <ul aria-labelledby="fact-languages" className="flex flex-wrap gap-2">
        {LANGUAGES.map((code) => {
          const on = form.languages.includes(code);
          return (
            <li key={code}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(code)}
                className={`min-h-11 border px-3 text-body-sm ${on ? "border-plum bg-plum text-paper" : "border-rule"}`}
              >
                {names.of(code) ?? code}
              </button>
            </li>
          );
        })}
      </ul>
    </Row>
  );
}

function Status(p: FieldsProps) {
  const { form, edit, words } = p;
  const options = [
    ["", words["facts.computed"]],
    ["break", words["status.break"]],
    ["help", words["status.help"]],
  ] as const;
  return (
    <Row {...p} field="status">
      <div role="radiogroup" aria-labelledby="fact-status" className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label
            key={value}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 ${form.status === value ? "border-plum" : "border-rule"}`}
          >
            <input
              type="radio"
              name="fact-status"
              checked={form.status === value}
              onChange={() => edit("status", { status: value })}
            />
            {label}
          </label>
        ))}
      </div>
    </Row>
  );
}

function Notes(p: FieldsProps) {
  const { form, edit, words } = p;
  return (
    <>
      <Row {...p} field="away">
        <label className="block text-body-sm">
          {words["facts.awayText"]}
          <input
            value={form.awayText}
            maxLength={500}
            onChange={(e) => edit("away", { awayText: e.target.value })}
            className={`${INPUT} mt-1`}
          />
        </label>
        <label className="mt-2 block text-body-sm">
          {words["facts.awayDay"]}
          <input
            type="date"
            value={form.awayUntil}
            onChange={(e) => edit("away", { awayUntil: e.target.value })}
            className={`${INPUT} mt-1 block max-w-56`}
          />
        </label>
      </Row>
      <Row {...p} field="notes">
        <textarea
          aria-labelledby="fact-notes"
          value={form.notes}
          maxLength={4000}
          rows={3}
          onChange={(e) => edit("notes", { notes: e.target.value })}
          className={`${INPUT} py-2`}
        />
      </Row>
    </>
  );
}

export function FactFields(p: FieldsProps) {
  return (
    <div>
      <Numbers {...p} />
      <Zone {...p} />
      <Languages {...p} />
      <Status {...p} />
      <Notes {...p} />
    </div>
  );
}
