"use client";

// The add and edit sheet of the Calendar tab (issue 300). Every time is typed in server time (ST) and shown
// at once on the officer's own clock. An edit sends only the fields that changed, each with the version it
// started from; a 409 shows who changed what first, with "Keep theirs" and "Use mine".
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { KINDS } from "@/lib/private/calendar-kinds";
import type { CalendarKey, CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaItem } from "./calendar-data";
import {
  changesOf,
  draftOf,
  newEntryOf,
  problems,
  withKind,
  type Change,
  type Draft,
} from "./calendar-draft";
import { refusalText, sendCalendar, type Stale } from "./calendar-send";
import { Choice, ConflictBox, FIELD, Labeled, TextInput } from "./CalendarFields";
import { DeleteArea } from "./DeleteArea";
import { KindFields, RepeatFields, TimeFields, type PartProps } from "./EntryFields";

export interface FormProps {
  words: CalendarWords;
  slug: string;
  /** The server's zone (SERVER_TZ), for the officer's own clock under the time. */
  zone: string;
  /** Add: the day it starts on, and whether the week already has its Alliance Duel theme. Edit: the entry. */
  mode: { add: true; day: string; hasTheme: boolean } | { add: false; item: AgendaItem };
  onDone: () => void;
  onClose: () => void;
}

/** Sending the sheet: a new entry, or the changed fields; after a 409, again without or with them. */
function useSave(props: FormProps, d: Draft) {
  const { mode, words } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<{ conflicts: Stale[]; changes: Change[] } | null>(null);
  async function send(changes: Change[] | null) {
    setBusy(true);
    setError(null);
    const body = mode.add
      ? { action: "create", entry: newEntryOf(d) }
      : { action: "edit", entry: mode.item.entry, week: mode.item.week, changes };
    const sent =
      changes?.length === 0 ? ({ ok: true } as const) : await sendCalendar(props.slug, body);
    setBusy(false);
    if (sent.ok) return props.onDone();
    setStale(sent.code === "stale" ? { conflicts: sent.conflicts, changes: changes ?? [] } : null);
    if (sent.code !== "stale") setError(refusalText(sent.code, words));
  }
  const newer = (c: Change) => stale?.conflicts.find((x) => x.field === c.field);
  return {
    busy,
    error,
    stale,
    save: () => void send(mode.add ? null : changesOf(d, mode.item.form)),
    keep: () => void send(stale?.changes.filter((c) => !newer(c)) ?? []),
    mine: () =>
      void send(
        stale?.changes.map((c) => ({ ...c, version: newer(c)?.version ?? c.version })) ?? [],
      ),
  };
}

function CommonFields({ d, set, p, words }: PartProps) {
  return (
    <>
      <Labeled id="cal-notes" label={words["calendar.form.notes"]}>
        <textarea
          id="cal-notes"
          rows={3}
          maxLength={1000}
          value={d.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className={FIELD}
        />
      </Labeled>
      <Labeled
        id="cal-link"
        label={words["calendar.form.link"]}
        error={p.shown && p.link ? words["calendar.form.linkBad"] : null}
      >
        <TextInput
          id="cal-link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={d.link}
          onChange={(e) => set({ link: e.target.value })}
        />
      </Labeled>
      <div className="mt-4">
        <CheckField
          label={words["calendar.form.members"]}
          help={words["calendar.form.membersHelp"]}
          checked={d.forMembers}
          onChange={(e) => set({ forMembers: e.target.checked })}
        />
      </div>
    </>
  );
}

export function EntryForm(props: FormProps) {
  const { words, mode } = props;
  const item = mode.add ? null : mode.item;
  const [d, setDraft] = useState<Draft>(() =>
    draftOf(item?.form ?? null, mode.add ? mode.day : ""),
  );
  const [shown, setShown] = useState(false);
  const save = useSave(props, d);
  const part: PartProps = {
    d,
    set: (x) => setDraft((old) => ({ ...old, ...x })),
    p: { ...problems(d), shown },
    words,
  };
  const kinds = KINDS.filter((k) => k !== "duel" || (mode.add && !mode.hasTheme));
  return (
    <Sheet labelledBy="cal-form-title" onCancel={props.onClose}>
      <div className="pb-2">
        <h2
          id="cal-form-title"
          data-initial-focus
          tabIndex={-1}
          className="font-subhead text-display-sm"
        >
          {item ? `${words["calendar.form.edit"]}: ${item.title}` : words["calendar.form.add"]}
        </h2>
        {!item && (
          <Choice
            legend={words["calendar.form.kind"]}
            name="cal-kind"
            value={d.kind}
            options={kinds.map((k) => ({
              value: k,
              label: words[`calendar.kind.${k}` as CalendarKey],
            }))}
            onChange={(k) => setDraft((old) => withKind(old, k))}
          />
        )}
        <KindFields {...part} />
        <TimeFields {...part} zone={props.zone} />
        <RepeatFields {...part} item={item} />
        <CommonFields {...part} />
        {save.stale && (
          <ConflictBox
            conflicts={save.stale.conflicts}
            words={words}
            busy={save.busy}
            onKeep={save.keep}
            onMine={save.mine}
          />
        )}
        {save.error && (
          <p role="alert" className="mt-4 border-l-4 border-seal pl-3 text-body-sm">
            {save.error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={save.busy || save.stale !== null}
            onClick={() => {
              setShown(true);
              if (Object.keys(problems(d)).length === 0) save.save();
            }}
            className={buttonClass("primary", "flex-1")}
          >
            {words["calendar.form.save"]}
          </button>
          <button type="button" onClick={props.onClose} className={buttonClass("secondary")}>
            {words["calendar.form.close"]}
          </button>
        </div>
        {item && <DeleteArea item={item} words={words} slug={props.slug} onDone={props.onDone} />}
      </div>
    </Sheet>
  );
}
