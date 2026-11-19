"use client";

// "Share the thanks", step one (issue 404, D114): who is named. The week's list starts ticked, each person
// with what they did in words; the officer may add anyone from the roster. Nobody is listed as missing (D75).
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { searchRoster } from "@/lib/private/roster-search";

import type { SharePerson, ShareThanksProps } from "./share-thanks-data";

/**
 * Who is named: the week's list, ticked, plus anyone the officer adds from the roster; and, for each, the
 * officer's optional few words about them.
 */
export function usePick(initial: SharePerson[]) {
  const [people, setPeople] = useState<SharePerson[]>(initial);
  const [ticked, setTicked] = useState<number[]>(initial.map((p) => p.uid));
  const [notes, setNotes] = useState<Record<number, string>>({});
  return {
    people,
    ticked,
    notes,
    chosen: people
      .filter((p) => ticked.includes(p.uid))
      .map((p) => ({ ...p, note: (notes[p.uid] ?? "").trim() })),
    note: (uid: number, text: string) => setNotes((n) => ({ ...n, [uid]: text })),
    toggle: (uid: number, on: boolean) =>
      setTicked((t) => (on ? [...t, uid] : t.filter((u) => u !== uid))),
    add: (m: { uid: number; name: string }) => {
      setPeople((list) => [...list, { ...m, did: [], line: "" }]);
      setTicked((t) => [...t, m.uid]);
    },
  };
}

/** "A few words about them (optional)", under a ticked person, indented to the name. */
function NoteField(props: {
  uid: number;
  value: string;
  limit: number;
  words: ShareThanksProps["words"];
  onChange: (text: string) => void;
}) {
  const id = `share-note-${props.uid}`;
  return (
    <div className="mt-1 pl-[34px]">
      <label htmlFor={id} className="text-body-sm text-ink/80">
        {props.words["share.note"]}
      </label>
      <input
        id={id}
        type="text"
        value={props.value}
        maxLength={props.limit}
        autoComplete="off"
        aria-describedby="share-note-help"
        onChange={(e) => props.onChange(e.target.value)}
        className={`${FIELD} mt-1 text-base`}
      />
    </div>
  );
}

/** Add someone the week's list does not hold: type part of a name, tap one of the matches. */
function AddSomeone(props: {
  roster: ShareThanksProps["roster"];
  words: ShareThanksProps["words"];
  onAdd: (m: { uid: number; name: string }) => void;
}) {
  const { words } = props;
  const [query, setQuery] = useState("");
  const found = query.trim() === "" ? [] : searchRoster(query, props.roster);
  // "Add {name}": the name in its own isolate, wherever the language puts it.
  const [before, after] = words["share.add.button"].split("{name}");
  return (
    <div className="mt-4">
      <label htmlFor="share-add" className="font-semibold">
        {words["share.add"]}
      </label>
      <input
        id="share-add"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        className={`${FIELD} mt-1 text-base`}
      />
      {query.trim() !== "" && found.length === 0 && (
        <p className="mt-1 text-body-sm">{words["share.add.none"]}</p>
      )}
      <ul className="mt-1">
        {found.map((m) => (
          <li key={m.uid}>
            <button
              type="button"
              onClick={() => {
                props.onAdd(m);
                setQuery("");
              }}
              className="flex min-h-11 w-full items-center border-t border-rule text-left font-semibold text-plum"
            >
              {before}
              <bdi translate="no">{m.name}</bdi>
              {after}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PickStep(props: {
  pick: ReturnType<typeof usePick>;
  roster: ShareThanksProps["roster"];
  words: ShareThanksProps["words"];
  noteLimit: number;
}) {
  const { pick, words } = props;
  return (
    <>
      <fieldset>
        <legend className="font-semibold">{words["share.pick"]}</legend>
        <p className="text-body-sm text-ink/80">
          {pick.people.length === 0 ? words["share.pick.none"] : words["share.pick.help"]}
        </p>
        <ul className="mt-2 space-y-3">
          {pick.people.map((p) => (
            <li key={p.uid}>
              <CheckField
                label={
                  <bdi translate="no" className="font-semibold">
                    {p.name}
                  </bdi>
                }
                {...(p.line && { help: p.line })}
                checked={pick.ticked.includes(p.uid)}
                onChange={(e) => pick.toggle(p.uid, e.target.checked)}
              />
              {pick.ticked.includes(p.uid) && (
                <NoteField
                  uid={p.uid}
                  value={pick.notes[p.uid] ?? ""}
                  limit={props.noteLimit}
                  words={words}
                  onChange={(text) => pick.note(p.uid, text)}
                />
              )}
            </li>
          ))}
        </ul>
        {pick.ticked.length > 0 && (
          <p id="share-note-help" className="mt-2 text-body-sm text-ink/70">
            {words["share.note.help"]}
          </p>
        )}
      </fieldset>
      <AddSomeone
        roster={props.roster.filter((m) => !pick.people.some((p) => p.uid === m.uid))}
        words={words}
        onAdd={pick.add}
      />
    </>
  );
}
