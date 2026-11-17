"use client";

// The top of a draft under review (issue 299): the type (one tap re-reads the pictures as another type),
// Daily or Weekly (asked when the picture cannot tell), the Alliance Duel's week and day, and where a Save
// puts the rows. Every choice is a row of 44 px buttons; nothing is hover-only.
import type { ImportKind, Scope } from "@/lib/private/import-kinds";
import type { DraftView } from "@/lib/private/import-view";

import { DAYS, fillIn, type Day, type Words } from "./draft-known";

export interface ReviewText {
  /** "week of Mon 16 Nov" for the picture's week and the one before. */
  weeks: [string, string];
  /** Mon to Sat of the picture's week, and of the week before: "Mon 16 Nov". */
  days: [string[], string[]];
  /** The picture's day among Mon-Sat (Sunday: Sat). */
  pictureDay: number;
}

interface Choices {
  scope: Scope | null;
  day: Day;
  weekBefore: boolean;
}

function Choice<T extends string | boolean>(props: {
  legend: string | undefined;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-body-sm font-semibold">{props.legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              disabled={props.disabled}
              onClick={() => props.onChange(o.value)}
              className={`inline-flex min-h-11 items-center border px-3 text-body-sm font-medium ${on ? "border-plum bg-plum text-paper" : "border-rule"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Where a kind that is not a ranking check saves. */
const WHERE: Partial<Record<ImportKind, string>> = {
  member_update: "shots.where.facts",
  secret_ops: "shots.where.thefts",
};

/** "Saves to: Alliance Duel points of each member, week of Mon 16 Nov", or a check's line. */
function whereText(view: DraftView, w: Words, text: ReviewText, c: Choices): string {
  const week = c.weekBefore ? 1 : 0;
  if (view.kind !== "alliance_duel") {
    const key = WHERE[view.kind] ?? "shots.where.check";
    return fillIn(w["shots.draft.saveTo"], { where: w[key] ?? "" });
  }
  const where =
    c.scope === "daily"
      ? fillIn(w["shots.where.duelDay"], { day: text.days[week][DAYS.indexOf(c.day)] ?? "" })
      : fillIn(w["shots.where.duelWeek"], { week: text.weeks[week] });
  return fillIn(w["shots.draft.saveTo"], { where });
}

function DuelChoices(props: {
  w: Words;
  text: ReviewText;
  choice: Choices;
  set: { day: (d: Day) => void; weekBefore: (b: boolean) => void };
  readOnly: boolean;
}) {
  const { w, text, choice } = props;
  const days = text.days[choice.weekBefore ? 1 : 0];
  return (
    <>
      <Choice
        legend={w["shots.draft.week"]}
        options={[false, true].map((b) => ({ value: b, label: text.weeks[b ? 1 : 0] }))}
        value={choice.weekBefore}
        onChange={props.set.weekBefore}
        disabled={props.readOnly}
      />
      {choice.scope === "daily" && (
        <Choice
          legend={w["shots.draft.day"]}
          options={DAYS.map((d, i) => ({ value: d, label: days[i] ?? d }))}
          value={choice.day}
          onChange={props.set.day}
          disabled={props.readOnly}
        />
      )}
    </>
  );
}

export function DraftHeader(props: {
  view: DraftView;
  w: Words;
  kinds: Record<ImportKind, string>;
  saveKinds: ImportKind[];
  text: ReviewText;
  choice: Choices;
  set: {
    scope: (s: Scope | null) => void;
    day: (d: Day) => void;
    weekBefore: (b: boolean) => void;
  };
  readOnly: boolean;
  retype: (kind: ImportKind) => void;
}) {
  const { view, w, choice, readOnly } = props;
  const scope = choice.scope;
  return (
    <section aria-label={w["shots.draft.type"]}>
      <Choice
        legend={w["shots.draft.type"]}
        options={props.saveKinds.map((k) => ({ value: k, label: props.kinds[k] }))}
        value={view.kind}
        onChange={props.retype}
        disabled={readOnly}
      />
      {scope !== null && !view.scopeSure && !readOnly && (
        <p className="mt-3 border-l-4 border-yarn pl-2">{w["shots.draft.confirmTab"]}</p>
      )}
      {scope !== null && (
        <Choice
          legend={w["shots.draft.tab"]}
          options={(["daily", "weekly"] as const).map((s) => ({
            value: s,
            label: w[`shots.scope.${s}`] ?? s,
          }))}
          value={scope}
          onChange={props.set.scope}
          disabled={readOnly}
        />
      )}
      {view.kind === "alliance_duel" && <DuelChoices {...props} />}
      <p className="mt-3 font-semibold">{whereText(view, w, props.text, choice)}</p>
    </section>
  );
}
