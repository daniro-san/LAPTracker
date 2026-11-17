"use client";

// Skipping or deleting a calendar entry (issue 300), asked once more before it happens. A one-off goes; a
// weekly entry skips this week only, or ends from this week on.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaItem } from "./calendar-data";
import { refusalText, sendCalendar } from "./calendar-send";

export function DeleteArea(props: {
  item: AgendaItem;
  words: CalendarWords;
  slug: string;
  onDone: () => void;
}) {
  const { item, words } = props;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove(scope: "all" | "one" | "after") {
    setBusy(true);
    const sent = await sendCalendar(props.slug, {
      action: "delete",
      entry: item.entry,
      scope,
      week: item.week,
    });
    setBusy(false);
    if (sent.ok || sent.code === "not_found") return props.onDone();
    setError(refusalText(sent.code, words));
  }
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="mt-4 min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
      >
        {words[item.form.weekly ? "calendar.delete.weekly" : "calendar.delete"]}
      </button>
    );
  }
  const choices: { scope: "all" | "one" | "after"; label: string }[] = item.form.weekly
    ? [
        {
          scope: "one",
          label: fill(words["calendar.delete.one"], { date: item.form.weekLabel }),
        },
        { scope: "after", label: words["calendar.delete.after"] },
      ]
    : [{ scope: "all", label: words["calendar.delete"] }];
  return (
    <div role="group" aria-labelledby="cal-delete-ask" className="mt-4 border-t border-rule pt-3">
      <p id="cal-delete-ask" className="font-semibold">
        {words[item.form.weekly ? "calendar.delete.askWeekly" : "calendar.delete.ask"]}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.scope}
            type="button"
            disabled={busy}
            onClick={() => void remove(c.scope)}
            className="min-h-11 border border-seal px-3 text-left font-semibold text-seal"
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAsking(false)}
          className={buttonClass("secondary", "justify-start")}
        >
          {words["calendar.delete.keep"]}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-body-sm">
          {error}
        </p>
      )}
    </div>
  );
}
