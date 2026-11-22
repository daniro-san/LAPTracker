"use client";

// Choosing a caravan seat's member (issues 300, 354): up to three suggestions first, each one tap; then type
// part of a name and the alliance's newest roster is filtered as you type, by name key (D74), so case,
// accents, emoji and decoration do not matter. The member in the other seat is shown but cannot be chosen:
// one person never holds both seats.
import { useState } from "react";

import { Sheet } from "@/lib/brand/components/Sheet";
import { searchRoster } from "@/lib/private/roster-search";
import { fill } from "@/lib/words";

import type { CalendarSheetWords, Member, SuggestedMember } from "./calendar-data";
import { Labeled, TextInput } from "./CalendarFields";
import { sheetWords } from "./sheet-words";

/** The suggestions, each one tap; or where to look when nobody qualifies. */
function Suggested({
  suggested,
  words,
  onPick,
}: {
  suggested: SuggestedMember[];
  words: CalendarSheetWords;
  onPick: (m: Member) => void;
}) {
  return (
    <section aria-labelledby="pick-suggested" className="mt-3">
      <h3 id="pick-suggested" className="text-body-sm font-semibold">
        {words["calendar.suggest.head"]}
      </h3>
      {suggested.length === 0 ? (
        <p className="mt-1 text-body-sm">{words["calendar.suggest.none"]}</p>
      ) : (
        // ph-no-capture (issue 549): the suggestions come in order of the week's quest points.
        <ul className="ph-no-capture mt-1">
          {suggested.map((m) => (
            <li key={m.uid} className="border-t border-rule">
              <button
                type="button"
                onClick={() => onPick(m)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span translate="no" className="block truncate font-semibold">
                    {m.name}
                  </span>
                  <span className="block text-body-sm text-ink/75">{m.why}</span>
                </span>
                <span className="shrink-0 text-body-sm text-plum">
                  {words["calendar.pick.choose"]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[12px] leading-4 text-ink/70">{words["calendar.suggest.how"]}</p>
    </section>
  );
}

export function RosterPicker(props: {
  role: string;
  roster: Member[];
  /** Up to three suggested members, with their reasons (issue 354). */
  suggested: SuggestedMember[];
  /** The member in the other seat, and that seat's name. */
  taken: Member | null;
  takenRole: string;
  words: CalendarSheetWords;
  onPick: (m: Member) => void;
  onClose: () => void;
}) {
  const { words } = props;
  const [query, setQuery] = useState("");
  const found = searchRoster(query, props.roster);
  return (
    <Sheet
      labelledBy="pick-title"
      onCancel={props.onClose}
      title={fill(words["calendar.pick.title"], { role: props.role })}
      words={sheetWords(words)}
    >
      <Suggested {...props} />
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
    </Sheet>
  );
}
