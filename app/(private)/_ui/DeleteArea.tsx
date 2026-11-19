"use client";

// Skipping or deleting a calendar entry (issue 300), asked once more before it happens. A one-off asks with the
// shared delete question (DeleteRecord, D123); a weekly entry skips this week only, or ends from this week on.
// A delete that takes the whole entry (a one-off, or a weekly one ended from its first week) is soft, under
// the question's request id (D100), and the Calendar then offers Undo.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaItem } from "./calendar-data";
import { refusalText, sendCalendar } from "./calendar-send";
import { DeleteButton, UndoLine } from "./DeleteRecord";
import { newRequestId } from "./request-id";
import { RefusalLine } from "./SignedOut";

type Scope = "all" | "one" | "after";

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
      <div className="mt-4">
        <DeleteButton
          id="cal-delete-ask"
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
          <p className="mt-3 font-subhead break-words">
            <bdi>{item.title}</bdi>
            <span className="block text-body-sm font-normal">
              {item.dayLabel}
              {item.st && ` · ${item.st}`}
            </span>
          </p>
          <p className="mt-2">{words["calendar.delete.where"]}</p>
        </DeleteButton>
      </div>
    );
  }
  return <WeeklyDelete {...props} request={request} />;
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

/** A weekly entry: skip this week, or end it from this week on (from its first week, it goes whole). */
function WeeklyDelete(props: {
  item: AgendaItem;
  words: CalendarWords;
  slug: string;
  onDone: () => void;
  onDeleted: (d: DeletedEntry) => void;
  request: (scope: Scope, requestId: string) => DeletedEntry;
}) {
  const { item, words } = props;
  /** The open question's request id (D100), new for each opening; null when closed. */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove(scope: Scope, requestId: string) {
    setBusy(true);
    const sent = await sendCalendar(props.slug, {
      action: "delete",
      ...props.request(scope, requestId),
    });
    setBusy(false);
    if (sent.ok && sent.deleted) props.onDeleted(props.request(scope, requestId));
    if (sent.ok || sent.code === "not_found") return props.onDone();
    setError(refusalText(sent.code, words));
  }
  if (asking === null) {
    return (
      <button
        type="button"
        onClick={() => setAsking(newRequestId())}
        className="mt-4 min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
      >
        {words["calendar.delete.weekly"]}
      </button>
    );
  }
  const choices: { scope: Scope; label: string }[] = [
    { scope: "one", label: fill(words["calendar.delete.one"], { date: item.form.weekLabel }) },
    { scope: "after", label: words["calendar.delete.after"] },
  ];
  return (
    <div role="group" aria-labelledby="cal-delete-ask" className="mt-4 border-t border-rule pt-3">
      <p id="cal-delete-ask" className="font-semibold">
        {words["calendar.delete.askWeekly"]}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.scope}
            type="button"
            disabled={busy}
            onClick={() => void remove(c.scope, asking)}
            className="min-h-11 border border-seal px-3 text-left font-semibold text-seal"
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAsking(null)}
          className={buttonClass("secondary", "justify-start")}
        >
          {words["calendar.delete.keep"]}
        </button>
      </div>
      {error && <RefusalLine text={error} className="mt-2 text-body-sm" />}
    </div>
  );
}
