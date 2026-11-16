"use client";

// The field groups of the Calendar's add and edit sheet (issue 300): what kind of entry and its own fields
// (which Cheese Trap or team, the level, a name or the week's theme), its day and server time with the
// officer's own time under it, and whether it repeats.
import type { ReactNode } from "react";

import { ELIXIR_WINDOWS, LEVEL_MAX, type Kind } from "@/lib/private/calendar-model";
import { hhmm, parseTime, zonedInstant } from "@/lib/private/calendar-time";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaItem } from "./calendar-data";
import type { Draft, problems } from "./calendar-draft";
import { Choice, FIELD, Labeled, TextInput } from "./CalendarFields";
import { useViewerZone, yourTime } from "./YourTime";

export interface PartProps {
  d: Draft;
  set: (x: Partial<Draft>) => void;
  p: ReturnType<typeof problems> & { shown: boolean };
  words: CalendarWords;
}

export const fillIn = (w: string, vars: Record<string, string | number>) =>
  w.replace(/\{(\w+)\}/g, (all, k: string) => String(vars[k] ?? all));

/** "Cheese Trap I / II" or "Team A / B", as the game writes them. */
function VariantField({ d, set, words }: PartProps) {
  const cheese = d.kind === "cheese";
  return (
    <Choice
      legend={words[cheese ? "calendar.form.which" : "calendar.form.team"]}
      name="cal-variant"
      value={d.variant}
      options={(cheese ? ["I", "II"] : ["A", "B"]).map((v) => ({
        value: v,
        label: cheese ? `Cheese Trap ${v}` : `Team ${v}`,
      }))}
      onChange={(variant) => set({ variant })}
    />
  );
}

function LevelField({ d, set, p, words }: PartProps) {
  return (
    <Labeled
      id="cal-level"
      label={fillIn(words["calendar.form.level"], { max: LEVEL_MAX })}
      error={p.shown && p.level ? words["calendar.form.needed"] : null}
    >
      <select
        id="cal-level"
        value={d.level}
        onChange={(e) => set({ level: e.target.value })}
        className={FIELD}
      >
        <option value="">—</option>
        {Array.from({ length: LEVEL_MAX }, (_, i) => (
          <option key={i} value={String(i + 1)}>{`Lv.${i + 1}`}</option>
        ))}
      </select>
    </Labeled>
  );
}

function TitleField({ d, set, p, words }: PartProps) {
  const theme = d.kind === "duel";
  return (
    <Labeled
      id="cal-title"
      label={words[theme ? "calendar.form.theme" : "calendar.form.name"]}
      error={p.shown && p.title ? words["calendar.form.needed"] : null}
      hint={words[theme ? "calendar.form.themeHint" : "calendar.form.nameHint"]}
    >
      <TextInput
        id="cal-title"
        maxLength={80}
        value={d.title}
        onChange={(e) => set({ title: e.target.value })}
      />
    </Labeled>
  );
}

const PARTS: Record<Kind, ((props: PartProps) => ReactNode)[]> = {
  caravan: [],
  cheese: [VariantField, LevelField],
  undead: [LevelField],
  elixir: [VariantField],
  kvk: [],
  duel: [TitleField],
  other: [TitleField],
};

export function KindFields(props: PartProps) {
  return PARTS[props.d.kind].map((Part, i) => <Part key={i} {...props} />);
}

/** The day, and the time in server time with the officer's own time under it as it is typed. */
export function TimeFields(props: PartProps & { zone: string }) {
  const { d, set, p, words } = props;
  const viewer = useViewerZone();
  const minute = parseTime(d.time);
  const local =
    viewer && minute !== null && d.day
      ? yourTime(zonedInstant(d.day, minute, props.zone), d.day, viewer, words)
      : null;
  const time =
    d.kind === "elixir" ? (
      <>
        <Choice
          legend={words["calendar.form.window"]}
          name="cal-window"
          value={d.time}
          options={ELIXIR_WINDOWS.map((m) => ({ value: hhmm(m), label: hhmm(m) }))}
          onChange={(value) => set({ time: value })}
        />
        {local && <p className="mt-1 text-body-sm text-ink/75">{local}</p>}
      </>
    ) : (
      <Labeled
        id="cal-time"
        label={words["calendar.form.time"]}
        error={p.shown && p.time ? words["calendar.form.timeBad"] : null}
        hint={local ?? words["calendar.form.timeHint"]}
      >
        <TextInput
          id="cal-time"
          inputMode="numeric"
          autoComplete="off"
          placeholder="21:00"
          value={d.time}
          onChange={(e) => set({ time: e.target.value })}
        />
      </Labeled>
    );
  return (
    <>
      <Labeled
        id="cal-day"
        label={words[d.kind === "duel" ? "calendar.form.week" : "calendar.form.day"]}
      >
        <input
          id="cal-day"
          type="date"
          required
          value={d.day}
          onChange={(e) => set({ day: e.target.value })}
          className={FIELD}
        />
      </Labeled>
      {d.kind !== "duel" && time}
    </>
  );
}

/** Add: once or every week. Edit of a weekly entry: a new day and time for this week only, or every week. */
export function RepeatFields(props: PartProps & { item: AgendaItem | null }) {
  const { d, set, words, item } = props;
  if (d.kind === "duel" || (item && !item.form.weekly)) return null;
  if (!item) {
    return (
      <Choice
        legend={words["calendar.form.repeat"]}
        name="cal-repeat"
        value={d.weekly ? "weekly" : "once"}
        options={[
          { value: "once", label: words["calendar.form.once"] },
          { value: "weekly", label: words["calendar.form.weekly"] },
        ]}
        onChange={(v) => set({ weekly: v === "weekly" })}
      />
    );
  }
  return (
    <>
      <Choice
        legend={words["calendar.form.scope"]}
        name="cal-scope"
        value={d.scope}
        options={[
          {
            value: "one",
            label: fillIn(words["calendar.form.scopeOne"], { date: item.form.weekLabel }),
          },
          { value: "all", label: words["calendar.form.scopeAll"] },
        ]}
        onChange={(scope) => set({ scope })}
      />
      <p className="mt-1 text-body-sm text-ink/75">{words["calendar.form.allWeeks"]}</p>
    </>
  );
}
