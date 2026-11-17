"use client";

// "Link to a member" for a new member who waits (D106): the newest roster, the closest names to theirs
// first under "Closest names", then everyone else by name; typing filters by name key (D74). One tap
// links; nothing is matched for the officer.
import { useState } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill, isolate } from "@/lib/copy";
import { closestFirst, searchRoster } from "@/lib/private/roster-search";

import type { LifecycleWords } from "./member-lifecycle-data";
import { sheetWords } from "./sheet-words";

export type RosterName = { uid: number; name: string };

/** Closest names offered first. */
const CLOSEST = 5;

function Names(props: {
  label: string | null;
  members: RosterName[];
  words: LifecycleWords;
  onPick: (uid: number) => void;
}) {
  if (props.members.length === 0) return null;
  return (
    <section className="mt-3">
      {props.label && <h3 className="text-body-sm font-semibold">{props.label}</h3>}
      <ul className="mt-1">
        {props.members.map((m) => (
          <li key={m.uid} className="border-t border-rule">
            <button
              type="button"
              onClick={() => props.onPick(m.uid)}
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span translate="no" className="min-w-0 truncate font-semibold">
                <bdi>{m.name}</bdi>
              </span>
              <span className="shrink-0 text-body-sm text-plum">{props.words["pending.pick"]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PendingLink(props: {
  name: string;
  roster: RosterName[];
  words: LifecycleWords;
  onPick: (uid: number) => void;
  onClose: () => void;
}) {
  const { words: t, roster } = props;
  const [query, setQuery] = useState("");
  const { closest, others } = closestFirst(props.name, roster, CLOSEST);
  const found = query.trim() === "" ? null : searchRoster(query, roster);
  return (
    <Sheet
      labelledBy="pending-link-title"
      onCancel={props.onClose}
      title={
        <span translate="no">{fill(t["pending.linkTitle"], { name: isolate(props.name) })}</span>
      }
      words={sheetWords(t)}
    >
      <p className="text-body-sm text-ink/80">{t["pending.linkHelp"]}</p>
      <label htmlFor="pending-link-q" className="mt-3 block font-semibold">
        {t["pending.search"]}
      </label>
      <input
        id="pending-link-q"
        type="search"
        autoComplete="off"
        maxLength={64}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`${FIELD} mt-1`}
      />
      {found === null ? (
        <>
          <Names label={t["pending.closest"]} members={closest} words={t} onPick={props.onPick} />
          <Names label={t["pending.others"]} members={others} words={t} onPick={props.onPick} />
        </>
      ) : found.length === 0 ? (
        <p className="mt-3">{t["pending.noMatch"]}</p>
      ) : (
        <Names label={null} members={found} words={t} onPick={props.onPick} />
      )}
    </Sheet>
  );
}
