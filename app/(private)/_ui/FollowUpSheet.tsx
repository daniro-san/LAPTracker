"use client";

// The Follow-up tab's record sheet (issue 340, D104), opened by "Add a note": the member's reasons and every
// fact still to ask, four answers in a 2 × 2 grid with none chosen at first (Save stays off until one is),
// "Back on" only for On a break, and a short note. One request id per open sheet (D100). On a break and
// They need help are member facts (D80): another officer's newer value comes back (409) in an amber line
// naming them, and a second Save replaces it. `send` and the row type are shared with the list.
import { useState } from "react";

import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import { addDays } from "@/lib/private/calendar-time";
import { FOLLOW_UP_ACTIONS, type FollowUpAction } from "@/lib/private/follow-up-rules";

import { FIELD, Labeled, TextInput } from "./CalendarFields";
import type { FollowUpWords } from "./follow-up-words";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface FollowUpRow {
  uid: number;
  name: string;
  rank: string | null;
  /** "Needs help" when an officer set it; the group heading says the rest. */
  tag: string | null;
  /** The short lines under the name, in the officer's words. */
  lines: string[];
  /** The longer lines the sheet shows (every fact still to ask). */
  detail: string[];
  /** The versions of the member's away and status facts the page saw (D80). */
  versions: { away: number; status: number };
}

/** The version of the fact an action writes; "talked" and "fine" write none. */
const versionOf = (row: FollowUpRow, action: FollowUpAction) =>
  action === "break" ? row.versions.away : action === "help" ? row.versions.status : 0;

type Sent = { status: number; body: { version?: number; said?: string } };

export async function send(slug: string, body: object): Promise<Sent | null> {
  const res = await fetch(`/api/w/${slug}/follow-up`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return null;
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Sent["body"] };
}

type SheetProps = {
  slug: string;
  row: FollowUpRow;
  today: string;
  language: string;
  words: FollowUpWords;
  onSaved: (requestId: string) => void;
  onClose: () => void;
};

type Stale = { said: string; version: number };

/** The sheet's answers, its check and its save. */
function useRecord(props: SheetProps) {
  const { row, words } = props;
  const [requestId] = useState(() => crypto.randomUUID());
  const [action, setAction] = useState<FollowUpAction | null>(null);
  const [backOn, setBackOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After a 409: who changed what, and the newer version, so the next Save replaces it. */
  const [stale, setStale] = useState<Stale | null>(null);
  const answer = (r: Sent | null) => {
    if (r?.status === 200) return props.onSaved(requestId);
    if (r?.status === 409 && r.body.said) {
      setError(null);
      return setStale({ said: r.body.said, version: r.body.version ?? 0 });
    }
    setError(r?.status === 401 ? SIGNED_OUT : words["followup.failed"]);
  };
  const save = async () => {
    if (!action) return;
    if (action === "break" && (backOn === "" || backOn <= props.today)) {
      return setError(words["followup.untilNeed"]);
    }
    setBusy(true);
    const r = await send(props.slug, {
      uid: row.uid,
      action,
      note,
      // The last day away is the day before they are back.
      until: action === "break" ? addDays(backOn, -1) : null,
      version: stale?.version ?? versionOf(row, action),
      requestId,
    });
    setBusy(false);
    answer(r);
  };
  const choose = (a: FollowUpAction) => {
    setAction(a);
    setStale(null);
    setError(null);
  };
  return { action, choose, backOn, setBackOn, note, setNote, busy, error, stale, save };
}

/** The four answers as an equal-width 2 × 2 grid of radio cards, 44 px or taller. */
function Answers(props: {
  value: FollowUpAction | null;
  words: FollowUpWords;
  onChange: (a: FollowUpAction) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-body-sm font-semibold">{props.words["followup.what"]}</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {FOLLOW_UP_ACTIONS.map((a) => (
          <label
            key={a}
            className={`drawn-frame-soft tint-button flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 ${
              props.value === a ? "bg-plum/10 font-semibold text-plum" : ""
            }`}
          >
            <input
              type="radio"
              name="follow-up-action"
              value={a}
              checked={props.value === a}
              onChange={() => props.onChange(a)}
              className="size-5 shrink-0 accent-plum"
            />
            {props.words[`followup.action.${a}`]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A server day as the rest of the screen writes it ("Wed, Nov 25"). */
const dayText = (day: string, language: string) =>
  new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

function Refusal({ f, words }: { f: ReturnType<typeof useRecord>; words: FollowUpWords }) {
  if (f.stale) {
    return (
      <p role="alert" className="mb-2 border-l-4 border-yarn pl-3 text-body-sm">
        {f.stale.said}
      </p>
    );
  }
  if (!f.error || f.error === words["followup.untilNeed"]) return null;
  return <RefusalLine text={f.error} className="mb-2 text-seal" />;
}

function BackOn(props: {
  f: ReturnType<typeof useRecord>;
  today: string;
  language: string;
  words: FollowUpWords;
}) {
  const { f, words } = props;
  const hint = (
    <>
      {f.backOn && (
        <span className="block font-semibold text-ink">
          {fill(words["followup.untilDay"], { date: dayText(f.backOn, props.language) })}
        </span>
      )}
      {words["followup.untilHelp"]}
    </>
  );
  return (
    <Labeled
      id="follow-up-until"
      label={words["followup.until"]}
      hint={hint}
      error={f.error === words["followup.untilNeed"] ? f.error : null}
    >
      <TextInput
        id="follow-up-until"
        type="date"
        min={addDays(props.today, 1)}
        value={f.backOn}
        onChange={(e) => f.setBackOn(e.target.value)}
      />
    </Labeled>
  );
}

export function RecordSheet(props: SheetProps) {
  const { row, words } = props;
  const f = useRecord(props);
  return (
    <Sheet
      labelledBy="follow-up-title"
      onCancel={props.onClose}
      title={<bdi translate="no">{row.name}</bdi>}
      words={sheetWords(words)}
      dirty={f.action !== null || f.backOn !== "" || f.note !== ""}
      primary={{
        label: words["followup.save"],
        onClick: f.save,
        disabled: f.busy || f.action === null,
      }}
      note={<Refusal f={f} words={words} />}
    >
      <ul className="text-body-sm">
        {row.detail.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Answers value={f.action} words={words} onChange={f.choose} />
      {f.action === "break" && (
        <BackOn f={f} today={props.today} language={props.language} words={words} />
      )}
      <Labeled id="follow-up-note" label={words["followup.note"]} hint={words["followup.noteHelp"]}>
        <textarea
          id="follow-up-note"
          rows={3}
          maxLength={500}
          value={f.note}
          onChange={(e) => f.setNote(e.target.value)}
          aria-describedby="follow-up-note-note"
          className={`${FIELD} py-2`}
        />
      </Labeled>
    </Sheet>
  );
}
