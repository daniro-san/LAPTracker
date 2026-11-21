"use client";

// An event's title with its state (issue 585): "· Started" in plum from its start, written like "· Today";
// "· Ended" in muted ink once it is surely over, with the title at regular weight and ink/75, so a past
// entry stands back at full contrast instead of being faded (its row's buttons still work). One for the
// desk's Home and Calendar, the members' board and a member's own page. `end` comes from `endOf` (an Elixir
// window's own end, else the end of the event's server day), since an entry has only a start time. `since`
// is when the server rendered the page, so server and browser HTML agree; with none the state waits for the
// browser's clock. The browser's minute takes over after hydration.
import type { ReactNode } from "react";

import { useMinute } from "./YourTime";

export function Ended(props: {
  at: number;
  end: number;
  words: { started: string; ended: string };
  since?: number;
  /** The title is bold until the event is over (the board, Home, Calendar); Me's lines are not. */
  bold?: boolean;
  children: ReactNode;
}) {
  const minute = useMinute();
  const now = minute === null ? (props.since ?? null) : minute * 60_000;
  const state = now === null || now < props.at ? null : now >= props.end ? "ended" : "started";
  return (
    <>
      <span className={state === "ended" ? "text-ink/75" : props.bold ? "font-semibold" : ""}>
        {props.children}
      </span>
      {state === "started" && (
        <span className="text-body-sm font-semibold text-plum">{` · ${props.words.started}`}</span>
      )}
      {state === "ended" && (
        <span className="text-body-sm text-ink/75">{` · ${props.words.ended}`}</span>
      )}
    </>
  );
}
