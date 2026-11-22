"use client";

// Skipping or deleting a calendar entry (issue 300), asked once more before it happens. A one-off asks with the
// shared delete question (DeleteRecord, D123); a weekly entry skips this week only, or ends from this week on.
// A delete that takes the whole entry (a one-off, or a weekly one ended from its first week) is soft, under
// the question's request id (D100), and the Calendar then offers Undo. The same question opens from the edit
// sheet and from the Delete beside Edit in a day card (`inCard`, issue 412 UX pass); from a card, a weekly
// entry's choices are asked in a sheet of their own.
import { useEffect, useRef, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";
import { fill } from "@/lib/words";

import type { AgendaItem } from "./calendar-data";
import { refusalText, sendCalendar } from "./calendar-send";
import { DeleteButton, UndoLine } from "./DeleteRecord";
import { newRequestId } from "./request-id";
import { RefusalLine } from "./SignedOut";

type Scope = "all" | "one" | "after";

/** The edit sheet's "Skip or delete": the seal text button. */
const SEAL_TEXT = "min-h-11 px-1 font-semibold text-seal underline underline-offset-4";
/** A day card's Delete: a quiet text button, 44 px, beside Edit. */
const CARD_BUTTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-body-sm font-semibold text-ink/75 underline underline-offset-4";

/** A delete the Calendar can take back: the request it was sent with. */
export interface DeletedEntry {
  entry: number;
  scope: Scope;
  week: string;
  requestId: string;
}

export function DeleteArea(props: {
  item: AgendaItem;
  words: CalendarWords;
  slug: string;
  onDone: () => void;
  onDeleted: (d: DeletedEntry) => void;
  /** Beside Edit in a day card, not in the edit sheet. */
  inCard?: boolean;
}) {
  const { item, words } = props;
  const request = (scope: Scope, requestId: string): DeletedEntry => ({
    entry: item.entry,
    scope,
    week: item.week,
    requestId,
  });
  if (!item.form.weekly) {
    return (
      <div className={props.inCard ? "contents" : "mt-4"}>
        <DeleteButton
          id={props.inCard ? `cal-delete-ask-${item.key}` : "cal-delete-ask"}
          {...(props.inCard && {
            className: CARD_BUTTON,
            ariaLabel: fill(words["calendar.deleteOf"], { title: item.title }),
          })}
          words={{
            label: words["calendar.delete"],
            ask: words["calendar.delete.ask"],
            confirm: words["calendar.delete"],
            deleting: words["calendar.delete.deleting"],
            keep: words["calendar.delete.keep"],
            failed: words["calendar.delete.failed"],
          }}
          send={async (requestId) => {
            const sent = await sendCalendar(props.slug, {
              action: "delete",
              ...request("all", requestId),
            });
            return sent.ok ? "ok" : sent.code;
          }}
          // Someone else's delete first: it is gone either way, with nothing of this officer's to undo.
          onDeleted={(requestId) => {
            if (requestId) props.onDeleted(request("all", requestId));
            props.onDone();
          }}
        >
          <EntryLine item={item} />
          <p className="mt-2">{words["calendar.delete.where"]}</p>
        </DeleteButton>
      </div>
    );
  }
  return <WeeklyDelete {...props} request={request} />;
}

/** Which entry the question is about: its title, day and server time. */
function EntryLine({ item }: { item: AgendaItem }) {
  return (
    <p className="mt-3 font-subhead break-words">
      <bdi>{item.title}</bdi>
      <span className="block text-body-sm font-normal">
        {item.dayLabel}
        {item.st && ` · ${item.st}`}
      </span>
    </p>
  );
}

/** The Calendar's line after a whole-entry delete: "Event deleted." with Undo. */
export function EntryUndoLine(props: {
  deleted: DeletedEntry;
  words: CalendarWords;
  slug: string;
  onUndone: () => void;
}) {
  const { words } = props;
  const undo = async () => {
    const body = { action: "delete", ...props.deleted, undo: true };
    if (!(await sendCalendar(props.slug, body)).ok) return false;
    props.onUndone();
    return true;
  };
  return (
    <UndoLine
      done={words["calendar.deleted"]}
      undo={words["calendar.undo"]}
      failed={words["calendar.undoFailed"]}
      onUndo={undo}
    />
  );
}

/** The weekly question's choices: skip this week, end from this week on, or keep it. */
function WeeklyChoices(props: {
  item: AgendaItem;
  words: CalendarWords;
  askId: string;
  inCard: boolean;
  busy: boolean;
  error: string | null;
  onChoose: (scope: Scope) => void;
  onKeep: () => void;
}) {
  const { item, words, inCard } = props;
  const choices: { scope: Scope; label: string }[] = [
    { scope: "one", label: fill(words["calendar.delete.one"], { date: item.form.weekLabel }) },
    { scope: "after", label: words["calendar.delete.after"] },
  ];
  const keep = (
    <button
      type="button"
      data-initial-focus
      onClick={props.onKeep}
      disabled={props.busy}
      className={buttonClass(inCard ? "primary" : "secondary", "justify-start")}
    >
      {words["calendar.delete.keep"]}
    </button>
  );
  return (
    <div
      role="group"
      aria-labelledby={props.askId}
      className={inCard ? undefined : "mt-4 border-t border-rule pt-3"}
    >
      <p id={props.askId} className={inCard ? "font-subhead text-display-sm" : "font-semibold"}>
        {words["calendar.delete.askWeekly"]}
      </p>
      {inCard && <EntryLine item={item} />}
      <div className="mt-2 flex flex-col gap-2">
        {/* In a sheet of its own, the safe answer comes first and has the focus (DESIGN.md "Question"). */}
        {inCard && keep}
        {choices.map((c) => (
          <button
            key={c.scope}
            type="button"
            disabled={props.busy}
            onClick={() => props.onChoose(c.scope)}
            className="min-h-11 border border-seal px-3 text-left font-semibold text-seal"
          >
            {c.label}
          </button>
        ))}
        {!inCard && keep}
      </div>
      {props.error && <RefusalLine text={props.error} className="mt-2 text-body-sm" />}
    </div>
  );
}

/** A weekly entry: skip this week, or end it from this week on (from its first week, it goes whole). */
function WeeklyDelete(props: {
  item: AgendaItem;
  words: CalendarWords;
  slug: string;
  onDone: () => void;
  onDeleted: (d: DeletedEntry) => void;
  request: (scope: Scope, requestId: string) => DeletedEntry;
  inCard?: boolean;
}) {
  const { item, words, inCard = false } = props;
  const askId = inCard ? `cal-delete-ask-${item.key}` : "cal-delete-ask";
  /** The open question's request id (D100), new for each opening; null when closed. */
  const [asking, setAsking] = useState<string | null>(null);
  /** Whether the card's sheet is still open when the answer comes (Escape or Back may close it first). */
  const open = useRef(false);
  useEffect(() => {
    open.current = asking !== null;
  }, [asking]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove(scope: Scope, requestId: string) {
    setBusy(true);
    const sent = await sendCalendar(props.slug, {
      action: "delete",
      ...props.request(scope, requestId),
    });
    setBusy(false);
    if (sent.ok || sent.code === "not_found") {
      const done = () => {
        if (sent.ok && sent.deleted) props.onDeleted(props.request(scope, requestId));
        props.onDone();
      };
      // From a card, the question's sheet steps off its history entry first, as DeleteButton does. A sheet
      // already closed while the delete was being sent has no entry left to step off.
      if (!inCard || !open.current) return done();
      window.addEventListener("popstate", done, { once: true });
      return setAsking(null);
    }
    setError(refusalText(sent.code, words));
  }
  const opener = (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setAsking(newRequestId());
      }}
      {...(inCard && {
        "aria-haspopup": "dialog" as const,
        "aria-label": fill(words["calendar.deleteOf"], { title: item.title }),
      })}
      className={inCard ? CARD_BUTTON : `mt-4 ${SEAL_TEXT}`}
    >
      {words[inCard ? "calendar.delete" : "calendar.delete.weekly"]}
    </button>
  );
  if (asking === null) return opener;
  const group = (
    <WeeklyChoices
      {...{ item, words, askId, inCard, busy, error }}
      onChoose={(scope) => void remove(scope, asking)}
      onKeep={() => setAsking(null)}
    />
  );
  if (!inCard) return group;
  return (
    <>
      {opener}
      <Sheet role="alertdialog" labelledBy={askId} onCancel={() => setAsking(null)}>
        {group}
      </Sheet>
    </>
  );
}
