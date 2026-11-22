"use client";

// Away dates (issues 298, 297, D80): a member's first and last day away, and what they said. It is the
// member's `away` fact, saved through the facts route with the version the officer saw: another officer's
// newer note comes back (409) with "Keep theirs" and "Use mine". While the dates run, the member is left
// out of roll calls and caravan suggestions. Opened on a member, or first asks who.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { dateWords } from "@/lib/date-words";
import type { AwayNote } from "@/lib/private/fact-fields";
import { searchRoster } from "@/lib/private/roster-search";
import { fill } from "@/lib/words";

import { FIELD, Labeled, TextInput } from "./CalendarFields";
import type { MarkRowView, RollSheetWords } from "./roll-call-data";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export type AwayWho = "pick" | MarkRowView;

type Sent = { ok: true } | { ok: false; conflict: { value: AwayNote | null; version: number } };

async function saveAway(
  slug: string,
  uid: number,
  value: AwayNote | null,
  version: number,
): Promise<Sent | "failed" | typeof SIGNED_OUT> {
  const res = await fetch(`/api/w/${slug}/members/${uid}/facts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ changes: [{ field: "away", version, value, source: "officer" }] }),
  }).catch(() => null);
  if (res?.status === 401) return SIGNED_OUT;
  if (!res || (res.status !== 200 && res.status !== 409)) return "failed";
  const { results } = (await res.json()) as {
    results: { status: string; value: AwayNote | null; version: number }[];
  };
  const r = results[0];
  return r?.status === "conflict"
    ? { ok: false, conflict: { value: r.value, version: r.version } }
    : { ok: true };
}

function Picker(props: {
  rows: MarkRowView[];
  words: RollSheetWords;
  onPick: (r: MarkRowView) => void;
}) {
  const [q, setQ] = useState("");
  const found = searchRoster(q, props.rows);
  return (
    <>
      <Labeled
        id="away-who"
        label={props.words["roll.away.who"]}
        hint={props.words["roll.away.whoHint"]}
      >
        <TextInput
          id="away-who"
          type="search"
          autoComplete="off"
          maxLength={64}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Labeled>
      <ul className="mt-2">
        {found.map((r) => (
          <li key={r.uid} className="border-t border-rule">
            <button
              type="button"
              onClick={() => props.onPick(r)}
              className="flex min-h-11 w-full items-center py-2 text-left font-semibold"
            >
              <bdi translate="no">{r.name}</bdi>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const dayText = (day: string | null | undefined, language: string) =>
  day ? dateWords(language, "UTC").day(day) : "—";

type Dates = { from: string; until: string; text: string };
type Conflict = { value: AwayNote | null; version: number };

/** The form as it opens: the member's note, or a new one starting today (D103: never in the past). */
const startOf = (note: AwayNote | null, today: string): Dates => ({
  from: note ? (note.from ?? "") : today,
  until: note?.until ?? "",
  text: note?.text ?? "",
});

/** Why the dates cannot be saved, or null. */
const problemOf = (d: Dates, words: RollSheetWords) =>
  !d.until ? words["roll.away.need"] : d.from && d.from > d.until ? words["roll.away.order"] : null;

/** The dates form, its checks, the save and the 409's two answers. */
function useAwayForm(
  slug: string,
  member: MarkRowView | null,
  words: RollSheetWords,
  done: () => void,
  today: string,
) {
  const start = startOf(member?.note ?? null, today);
  const [dates, setDates] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [busy, setBusy] = useState(false);
  const version = conflict?.version ?? member?.noteVersion ?? 0;
  const send = async (value: AwayNote | null) => {
    if (!member) return;
    setBusy(true);
    const r = await saveAway(slug, member.uid, value, version);
    setBusy(false);
    if (r === SIGNED_OUT || r === "failed") {
      setError(r === SIGNED_OUT ? r : words["roll.away.failed"]);
    } else if (r.ok) done();
    else setConflict(r.conflict);
  };
  const save = () => {
    const problem = problemOf(dates, words);
    setError(problem);
    if (!problem) {
      void send({ text: dates.text.trim(), from: dates.from || null, until: dates.until });
    }
  };
  const set = (k: keyof Dates, v: string) => setDates((d) => ({ ...d, [k]: v }));
  const keys = Object.keys(start) as (keyof Dates)[];
  const dirty = member !== null && keys.some((k) => dates[k] !== start[k]);
  /** A member picked in the sheet: the form opens on their note. */
  const load = (m: MarkRowView) => setDates(startOf(m.note, today));
  return { dates, set, error, conflict, busy, save, clear: () => void send(null), dirty, load };
}

function AwayConflict(props: {
  conflict: Conflict;
  words: RollSheetWords;
  language: string;
  busy: boolean;
  onKeep: () => void;
  onMine: () => void;
}) {
  const { words } = props;
  const v = props.conflict.value;
  const range = v
    ? fill(words["roll.away.range"], {
        from: dayText(v.from, props.language),
        to: dayText(v.until, props.language),
      })
    : "—";
  return (
    <div role="alert" className="mt-4 border-l-4 border-yarn pl-3">
      <p className="text-body-sm">
        {fill(words["roll.away.conflict"], { value: v?.text ? `${range} · ${v.text}` : range })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={props.onKeep} className={buttonClass("secondary")}>
          {words["roll.away.keep"]}
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onMine}
          className={buttonClass("primary")}
        >
          {words["roll.away.mine"]}
        </button>
      </div>
    </div>
  );
}

function AwayFields({ f, words }: { f: ReturnType<typeof useAwayForm>; words: RollSheetWords }) {
  const day = (id: string, k: keyof Dates, label: string) => (
    <Labeled id={id} label={label}>
      <TextInput
        id={id}
        type="date"
        value={f.dates[k]}
        onChange={(e) => f.set(k, e.target.value)}
      />
    </Labeled>
  );
  return (
    <>
      <p className="text-body-sm text-ink/75">{words["roll.away.help"]}</p>
      {day("away-from", "from", words["roll.away.from"])}
      {day("away-to", "until", words["roll.away.to"])}
      <Labeled id="away-text" label={words["roll.away.text"]}>
        <textarea
          id="away-text"
          rows={3}
          maxLength={500}
          value={f.dates.text}
          onChange={(e) => f.set("text", e.target.value)}
          className={`${FIELD} py-2`}
        />
      </Labeled>
    </>
  );
}

export function AwaySheet(props: {
  slug: string;
  who: AwayWho;
  rows: MarkRowView[];
  words: RollSheetWords;
  language: string;
  /** Today's server day: a new note starts on it. */
  today: string;
  onClose: () => void;
}) {
  const { words } = props;
  const router = useRouter();
  const [member, setMember] = useState(props.who === "pick" ? null : props.who);
  const done = () => {
    router.refresh();
    props.onClose();
  };
  const f = useAwayForm(props.slug, member, words, done, props.today);
  const pick = (m: MarkRowView) => {
    setMember(m);
    f.load(m);
  };
  const editing = member !== null && f.conflict === null;
  const title = member ? (
    <>
      {`${words["roll.away.title"]} · `}
      <bdi translate="no">{member.name}</bdi>
    </>
  ) : (
    words["roll.away.title"]
  );
  return (
    <Sheet
      labelledBy="away-title"
      onCancel={props.onClose}
      title={title}
      words={sheetWords(words)}
      dirty={f.dirty}
      {...(editing && {
        primary: { label: words["roll.away.save"], disabled: f.busy, onClick: f.save },
      })}
      {...(editing &&
        member.note && { secondary: { label: words["roll.away.clear"], onClick: f.clear } })}
      note={f.error && <RefusalLine text={f.error} className="mb-2 text-seal" />}
    >
      {member === null ? (
        <Picker rows={props.rows} words={words} onPick={pick} />
      ) : (
        <>
          <AwayFields f={f} words={words} />
          {f.conflict && (
            <AwayConflict
              conflict={f.conflict}
              words={words}
              language={props.language}
              busy={f.busy}
              onKeep={done}
              onMine={f.save}
            />
          )}
        </>
      )}
    </Sheet>
  );
}
