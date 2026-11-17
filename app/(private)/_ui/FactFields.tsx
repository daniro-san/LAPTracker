"use client";

// The member-facts editor's inputs (issue 297, D80), one row per field with its label and, when it has a
// value, where it came from: "from this message · not saved" for a value the paste box found, else the
// stored source as plain words ("typed by an officer", the default, says nothing). Every control is 44 px
// or more; nothing is hover-only.
import { useMemo, type ReactNode } from "react";

import { chip, FIELD } from "@/lib/brand/components/controls";
import { LANGUAGES, TIER_MAX, type FactField, type MemberFacts } from "@/lib/private/fact-fields";
import { mightIn } from "@/lib/private/onboarding-parse";

import { say, SOURCE_KEY, type EditorWords, type Form } from "./facts-form";
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
  /** The status shown when no officer sets one, for "Automatic (now: …)". */
  autoStatus: string;
  /** Under a field: another officer's newer value and the two answers. */
  conflictOf: (field: FactField) => ReactNode;
}

const INPUT = FIELD;

function Row(props: FieldsProps & { field: FactField; children: ReactNode }) {
  const { field, words, stored, fromMessage } = props;
  const source = stored[field]?.value != null ? (stored[field]?.source ?? null) : null;
  return (
    <div className="border-t border-rule py-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span id={`fact-${field}`} className="font-semibold">
          {words[`facts.${field}`]}
        </span>
        {fromMessage.has(field) ? (
          <span className="text-[12px] font-semibold text-yarn">{words["src.unsaved"]}</span>
        ) : (
          source &&
          source !== "officer" && (
            <span className="text-[12px] text-ink/70">{words[SOURCE_KEY[source]]}</span>
          )
        )}
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
  const might = mightIn(form.squadMight);
  return (
    <>
      <Row {...p} field="squadMight">
        <input
          aria-labelledby="fact-squadMight"
          aria-describedby="fact-squadMight-n"
          inputMode="decimal"
          value={form.squadMight}
          aria-invalid={invalid.includes("squadMight") || undefined}
          placeholder={words["facts.mightHint"]}
          onChange={(e) => edit("squadMight", { squadMight: e.target.value })}
          className={INPUT}
        />
        {/* What Save stores, digits grouped: "12.3M" reads 12,300,000. */}
        <p id="fact-squadMight-n" className="mt-1 min-h-5 text-body-sm text-ink/80 tabular-nums">
          {might === null ? "" : new Intl.NumberFormat(p.language).format(might)}
        </p>
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
              className={chip()}
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
                className={chip(on)}
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
    ["", say(words["facts.computed"], { status: p.autoStatus })],
    ["break", words["status.break"]],
    ["help", words["status.help"]],
  ] as const;
  return (
    <Row {...p} field="status">
      <div role="radiogroup" aria-labelledby="fact-status" className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label
            key={value}
            className={`${chip()} cursor-pointer gap-2 text-body ${form.status === value ? "bg-plum/10 font-semibold text-plum" : ""}`}
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
