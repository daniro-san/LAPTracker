"use client";

// The Calendar's head row (owner, issue 412 UX pass): the title, then "Today ↓" while the week shown holds
// today, and "Add an event". The page opens at the top, so both are in view when it loads; "Today ↓" is a
// link to today's day card (#d-<day>) that also moves the focus to its heading.
import type { ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";

import type { CalendarSheetWords } from "./calendar-data";

/** The page's head row: the title, then "Today ↓" (this week only) and "Add an event". */
export function HeadRow(props: {
  head: ReactNode;
  today: string | undefined;
  words: CalendarSheetWords;
  onAdd: () => void;
}) {
  const { today, words } = props;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">{props.head}</div>
      <div className="flex w-full gap-2 sm:w-auto">
        {today && (
          <a
            href={`#d-${today}`}
            // The link scrolls; the focus follows to today's heading for the keyboard.
            onClick={() =>
              requestAnimationFrame(() =>
                document.getElementById(`d-${today}-head`)?.focus({ preventScroll: true }),
              )
            }
            className={`${chip()} shrink-0 justify-center font-semibold text-plum`}
          >
            {words["calendar.toToday"]}
            <span aria-hidden="true">{" ↓"}</span>
          </a>
        )}
        <button
          type="button"
          onClick={props.onAdd}
          className={buttonClass("primary", "flex-1 sm:flex-none")}
        >
          {words["calendar.add"]}
        </button>
      </div>
    </div>
  );
}
