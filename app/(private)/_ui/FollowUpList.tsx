"use client";

// The Follow-up tab's list (issue 340, D104): one row per member to look at, with the reasons as the
// Members tab words them, and "Note what happened", a sheet with four answers (Talked to them, On a break
// until a day, Needs help, All fine) and a short note. The sheet makes one request id when it opens (D100).
// After a save the page is read again, so the member leaves the list; a line says so. On a break and
// Needs help are member facts (D80): another officer's newer value comes back (409) in a line, and a
// second Save replaces it.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill, isolate } from "@/lib/copy";
import { FOLLOW_UP_ACTIONS, type FollowUpAction } from "@/lib/private/follow-up-rules";

import { Choice, FIELD, Labeled, TextInput } from "./CalendarFields";
import type { FollowUpWords } from "./follow-up-words";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface FollowUpRow {
  uid: number;
  name: string;
  rank: string | null;
  /** The reasons with their evidence, and what is still to ask, in the officer's words. */
  lines: string[];
  /** The versions of the member's away and status facts the page saw (D80). */
  versions: { away: number; status: number };
}

/** The version of the fact an action writes; "talked" and "fine" write none. */
const versionOf = (row: FollowUpRow, action: FollowUpAction) =>
  action === "break" ? row.versions.away : action === "help" ? row.versions.status : 0;

type SheetProps = {
  slug: string;
  row: FollowUpRow;
  today: string;
  words: FollowUpWords;
  onSaved: () => void;
  onClose: () => void;
};

/** The sheet's answers, its check and its save. */
function useRecord(props: SheetProps) {
  const { row, words } = props;
  const [requestId] = useState(() => crypto.randomUUID());
  const [action, setAction] = useState<FollowUpAction>("talked");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After a 409: the newer version, so the next Save replaces it. */
  const [newer, setNewer] = useState<number | null>(null);
  const badUntil = action === "break" && (until === "" || until < props.today);
  const save = async () => {
    if (badUntil) return setError(words["followup.untilNeed"]);
    setBusy(true);
    const res = await fetch(`/api/w/${props.slug}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uid: row.uid,
        action,
        note,
        until: action === "break" ? until : null,
        version: newer ?? versionOf(row, action),
        requestId,
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 200) return props.onSaved();
    if (res?.status === 409) {
      const stale = (await res.json()) as { version: number; said: string };
      setNewer(stale.version);
      return setError(stale.said);
    }
    setError(res?.status === 401 ? SIGNED_OUT : words["followup.failed"]);
  };
  const choose = (a: FollowUpAction) => {
    setAction(a);
    setNewer(null);
    setError(null);
  };
  return { action, choose, until, setUntil, note, setNote, busy, error, save };
}

function RecordSheet(props: SheetProps) {
  const { row, words } = props;
  const { action, choose, until, setUntil, note, setNote, busy, error, save } = useRecord(props);
  return (
    <Sheet
      labelledBy="follow-up-title"
      onCancel={props.onClose}
      title={<bdi translate="no">{row.name}</bdi>}
      words={sheetWords(words)}
      dirty={action !== "talked" || until !== "" || note !== ""}
      primary={{ label: words["followup.save"], onClick: save, disabled: busy }}
      note={error && <RefusalLine text={error} className="mb-2 text-seal" />}
    >
      <ul className="text-body-sm">
        {row.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Choice
        legend={words["followup.what"]}
        name="follow-up-action"
        value={action}
        options={FOLLOW_UP_ACTIONS.map((a) => ({ value: a, label: words[`followup.action.${a}`] }))}
        onChange={choose}
      />
      {action === "break" && (
        <Labeled
          id="follow-up-until"
          label={words["followup.until"]}
          hint={words["followup.untilHelp"]}
          error={error === words["followup.untilNeed"] ? error : null}
        >
          <TextInput
            id="follow-up-until"
            type="date"
            min={props.today}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Labeled>
      )}
      <Labeled id="follow-up-note" label={words["followup.note"]} hint={words["followup.noteHelp"]}>
        <textarea
          id="follow-up-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-describedby="follow-up-note-note"
          className={`${FIELD} py-2`}
        />
      </Labeled>
    </Sheet>
  );
}

export function FollowUpList(props: {
  slug: string;
  rows: FollowUpRow[];
  today: string;
  words: FollowUpWords;
}) {
  const { words } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FollowUpRow | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <>
      <p role="status" className="mt-2 text-body-sm font-semibold text-sage empty:hidden">
        {saved && fill(words["followup.saved"], { name: isolate(saved) })}
      </p>
      <ul className="mt-2 empty:hidden">
        {props.rows.map((row) => (
          <li key={row.uid} className="border-t border-rule py-3">
            <p className="font-semibold">
              <bdi translate="no">{row.name}</bdi>
              {row.rank && <span className="font-normal text-ink/75">{` · ${row.rank}`}</span>}
            </p>
            {row.lines.map((line) => (
              <p key={line} className="text-body-sm text-yarn">
                {line}
              </p>
            ))}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  setSaved(null);
                  setOpen(row);
                }}
                className={buttonClass("secondary")}
              >
                {words["followup.record"]}
              </button>
              <a
                href={`/w/${props.slug}/members?q=${encodeURIComponent(row.name)}`}
                className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
              >
                {words["followup.inMembers"]}
              </a>
            </div>
          </li>
        ))}
      </ul>
      {open && (
        <RecordSheet
          slug={props.slug}
          row={open}
          today={props.today}
          words={words}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setSaved(open.name);
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
