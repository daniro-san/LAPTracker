"use client";

// Choosing a caravan seat's member (issue 300): type part of a name and the alliance's newest roster is
// filtered as you type, by name key (D74), so case, accents, emoji and decoration do not matter. The member
// in the other seat is shown but cannot be chosen: one person never holds both seats.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";
import { searchRoster } from "@/lib/private/roster-search";

import type { Member } from "./calendar-data";
import { Labeled, TextInput } from "./CalendarFields";

export function RosterPicker(props: {
  role: string;
  roster: Member[];
  /** The member in the other seat, and that seat's name. */
  taken: Member | null;
  takenRole: string;
  words: CalendarWords;
  onPick: (m: Member) => void;
  onClose: () => void;
}) {
  const { words } = props;
  const [query, setQuery] = useState("");
  const found = searchRoster(query, props.roster);
  return (
    <Sheet labelledBy="pick-title" onCancel={props.onClose}>
      <div className="max-h-[85dvh] overflow-y-auto">
        <h2
          id="pick-title"
          data-initial-focus
          tabIndex={-1}
          className="font-subhead text-display-sm"
        >
          {words["calendar.pick.title"].replace("{role}", props.role)}
        </h2>
        {props.roster.length === 0 ? (
          <p className="mt-3">{words["calendar.pick.noRoster"]}</p>
        ) : (
          <Labeled
            id="pick-q"
            label={words["calendar.pick.search"]}
            hint={words["calendar.pick.hint"]}
          >
            <TextInput
              id="pick-q"
              type="search"
              autoComplete="off"
              maxLength={64}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Labeled>
        )}
        {query.trim() !== "" && found.length === 0 && (
          <p className="mt-3">{words["calendar.pick.none"]}</p>
        )}
        <ul className="mt-2">
          {found.map((m) => {
            const taken = m.uid === props.taken?.uid;
            return (
              <li key={m.uid} className="border-t border-rule">
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => props.onPick(m)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
                >
                  <span translate="no" className="min-w-0 truncate font-semibold">
                    {m.name}
                  </span>
                  <span className="shrink-0 text-body-sm text-plum">
                    {taken ? props.takenRole : words["calendar.pick.choose"]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={props.onClose} className={buttonClass("secondary", "mt-4")}>
          {words["calendar.form.close"]}
        </button>
      </div>
    </Sheet>
  );
}
