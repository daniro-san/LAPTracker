"use client";

// The top of a draft under review (issue 299): the type (one tap re-reads the pictures as another type),
// Daily or Weekly (when the picture cannot tell, neither tab is pressed until the officer picks one), the
// Alliance Duel's week and day, and where a Save puts the rows (a check writes nothing to members). Every
// choice is a row of 44 px buttons; nothing is hover-only.
import { chip } from "@/lib/brand/components/controls";
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
  /** null: nothing chosen yet, no button pressed. */
  value: T | null;
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
              className={chip(on)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Where a kind saves, when it is not Alliance Duel or a check. */
const WHERE: Partial<Record<ImportKind, string>> = {
  member_update: "shots.where.facts",
  secret_ops: "shots.where.thefts",
};

/** "Saves to: Alliance Duel points of each member, week of Mon 16 Nov"; a check writes nothing. */
function whereText(view: DraftView, w: Words, text: ReviewText, c: Choices): string | undefined {
  const other = WHERE[view.kind];
  if (other) return fillIn(w["shots.draft.saveTo"], { where: w[other] ?? "" });
  if (view.kind !== "alliance_duel") return w["shots.where.check"];
  if (c.scope === null) return w["shots.where.pickTab"];
  const week = c.weekBefore ? 1 : 0;
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
    scope: (s: Scope) => void;
    day: (d: Day) => void;
    weekBefore: (b: boolean) => void;
  };
  readOnly: boolean;
  retype: (kind: ImportKind) => void;
}) {
  const { view, w, choice, readOnly } = props;
  // A kind with a Daily and a Weekly tab; the draft keeps the classifier's guess in view.scope.
  const tabbed = view.scope !== null;
  return (
    <section aria-label={w["shots.draft.type"]}>
      <Choice
        legend={w["shots.draft.type"]}
        options={props.saveKinds.map((k) => ({ value: k, label: props.kinds[k] }))}
        value={view.kind}
        onChange={props.retype}
        disabled={readOnly}
      />
      {tabbed && choice.scope === null && !readOnly && (
        <p className="mt-3 border-l-4 border-yarn pl-2">{w["shots.draft.confirmTab"]}</p>
      )}
      {tabbed && (
        <Choice
          legend={w["shots.draft.tab"]}
          options={(["daily", "weekly"] as const).map((s) => ({
            value: s,
            label: w[`shots.scope.${s}`] ?? s,
          }))}
          value={choice.scope}
          onChange={props.set.scope}
          disabled={readOnly}
        />
      )}
      {view.kind === "alliance_duel" && <DuelChoices {...props} />}
      <p className="mt-3 font-semibold">{whereText(view, w, props.text, choice)}</p>
    </section>
  );
}
