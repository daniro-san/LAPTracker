"use client";

// A member's Follow-up panel (issue 340, D104; issue 460, D140), opened by a tap on the person or "Add a
// note": a sheet below 1024, the pane beside the list from 1024 (D122). Top to bottom: where they came from
// (the card's origin lines, D136), why they are on the list, a ready message in their language with "Copy
// for game mail" and "Copy for Discord" (nothing is sent for the officer), "Fill in what they told you"
// (each fact still to ask opens the facts editor at its field; "Paste what they told you", D109), how it
// went (four answers in a 2 × 2 grid, none chosen at first, Save off until one is; "Back on" only for On a
// break; a short note) and the last notes. One request id per open panel (D100). On a break and They need
// help are member facts (D80): another officer's newer value comes back (409) in an amber line naming
// them, and a second Save replaces it. `send` and the row type are shared with the list.
import { useEffect, useState } from "react";

import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import { addDays } from "@/lib/private/calendar-time";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import type { FactField } from "@/lib/private/fact-fields";
import { FOLLOW_UP_ACTIONS, type FollowUpAction } from "@/lib/private/follow-up-rules";

import { FIELD, Labeled, TextInput } from "./CalendarFields";
import { focusField } from "./FactFields";
import { FactsEditor } from "./FactsEditor";
import { send } from "./follow-up-send";
import type { FollowUpWords } from "./follow-up-words";
import { HEAD, Message, SECTION } from "./FollowUpMessage";
import { Fill, Notes, useCard, Why, type Editing } from "./FollowUpPanelParts";
import type { EditorContext } from "./MemberCards";
import { newRequestId } from "./request-id";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** One line of why a member is on the list; `quote`: an officer's note. */
export type RowLine = { text: string; quote?: boolean };

export interface FollowUpRow {
  uid: number;
  name: string;
  rank: string | null;
  /** An officer's Needs help mark stands (issue 585 S2): the row is under "Needs help", with a way out. */
  help: boolean;
  /**
   * Why they are on the list: the Needs help mark, the reasons, the facts still to ask, the tip, last
   * week's context; `quote` marks an officer's note, clamped on the row and whole in the panel.
   */
  lines: RowLine[];
  /** Every fact still to ask, each a way into the facts editor at its field. */
  ask: { field: FactField; label: string }[];
  /** The ready message in each language, and the one shown first: the member's, else the officer's (D140). */
  message: { language: WorkspaceLanguage; texts: Record<WorkspaceLanguage, string> };
  /** The versions of the member's away and status facts the page saw (D80). */
  versions: { away: number; status: number };
}

/** The version of the fact an action writes; "talked" and "fine" write none. */
const versionOf = (row: FollowUpRow, action: FollowUpAction) =>
  action === "break" ? row.versions.away : action === "help" ? row.versions.status : 0;

type Sent = Awaited<ReturnType<typeof send>>;

type PanelProps = {
  slug: string;
  row: FollowUpRow;
  today: string;
  language: string;
  words: FollowUpWords;
  editor: EditorContext;
  /** Beside the list from 1024 (D122), not a dialog. */
  pane: boolean;
  onSaved: (requestId: string) => void;
  /** "No longer needs help" saved (issue 585 S2). */
  onCleared: () => void;
  onClose: () => void;
};

type Stale = { said: string; version: number };

/** The panel's answers, its check and its save. */
function useRecord(props: PanelProps) {
  const { row, words } = props;
  const [requestId] = useState(() => newRequestId());
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
    // In a div: the section's rule on a fieldset would run through its legend.
    <div className={SECTION}>
      <fieldset>
        <legend className={HEAD}>{props.words["followup.what"]}</legend>
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
    </div>
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

export function FollowUpPanel(props: PanelProps) {
  const { row, words } = props;
  const f = useRecord(props);
  const card = useCard(props.slug, row.uid);
  const [editing, setEditing] = useState<Editing | null>(null);
  const data = card.data;
  // A fact still to ask opens the editor at its field: after the editor's sheet took its first focus.
  useEffect(() => {
    if (editing?.focus) focusField(editing.focus);
  }, [editing]);
  return (
    <Sheet
      pane={props.pane}
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
      {row.rank && (
        <p translate="no" className="text-body-sm text-ink/80">
          {row.rank}
        </p>
      )}
      {/* Officers always see where a member came from (D136). */}
      {data?.origin.map((line) => (
        <p key={line} className="text-body-sm text-ink/80">
          {line}
        </p>
      ))}
      <Why slug={props.slug} row={row} words={words} onCleared={props.onCleared} />
      <Message message={row.message} words={words} where="follow_up" />
      <Fill row={row} words={words} card={card} onOpen={setEditing} />
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
      <Notes card={card} words={words} />
      {editing && data && (
        <FactsEditor
          {...props.editor}
          uid={row.uid}
          name={row.name}
          facts={data.stored}
          autoStatus={data.autoStatus}
          mode={editing.mode}
          onClose={() => {
            // Read the card again, so a second edit starts from this save's versions, not a 409.
            setEditing(null);
            card.reload();
          }}
        />
      )}
    </Sheet>
  );
}
