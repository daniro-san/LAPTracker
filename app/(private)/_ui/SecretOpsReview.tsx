"use client";

// A Secret Ops report under review (issues 299, 321): the report never says whose it is, so the officer
// picks the member who was robbed (their own player first, when "This is me" is set; otherwise nobody
// until chosen). Each entry shows what the sentence said and when, with its attacker's name to fix or
// the row to drop. Save hands the entries to the thefts log (D97) and says how many it saved and why the
// others were left out, with a link to the log. Help lines are shown and never saved.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import type { ImportKind } from "@/lib/private/import-kinds";
import type { DraftView } from "@/lib/private/import-view";

import { Actions, Message, useDraftActions } from "./draft-actions";
import { fillIn, type Words } from "./draft-known";
import { DraftHeader, type ReviewText } from "./DraftHeader";

interface Entry {
  name: string;
  dropped: boolean;
}

type Saved = { saved: number; left: { help: number; own: number; duplicate: number } };

/** A report has no tab, day or week to choose. */
const NO_CHOICE = { scope: null, day: "sat", weekBefore: false } as const;
const noop = () => undefined;

const KIND_WORD = { theft: "shots.entry.theft", help: "shots.entry.help" } as const;

function EntryCard(props: {
  i: number;
  row: DraftView["rows"][number];
  entry: Entry;
  onChange: (next: Entry) => void;
  w: Words;
  readOnly: boolean;
}) {
  const { row, entry, w } = props;
  const kind = row.entry?.kind ?? null;
  const at = row.entry?.at;
  return (
    <li className={`border border-rule px-3 py-3 ${entry.dropped ? "opacity-60" : ""}`}>
      <p className="text-body-sm">
        {w[kind ? KIND_WORD[kind] : "shots.entry.unknown"]}
        {at && ` · ${fillIn(w["shots.at"], { at })}`}
      </p>
      {!entry.dropped && kind !== "help" && (
        <label className="mt-1 block text-body-sm" htmlFor={`entry-${props.i}`}>
          {w["shots.attacker"]}
          <input
            id={`entry-${props.i}`}
            value={entry.name}
            maxLength={64}
            translate="no"
            disabled={props.readOnly}
            onChange={(e) => props.onChange({ ...entry, name: e.target.value })}
            className="mt-1 block min-h-11 w-full border border-rule bg-paper px-2"
          />
        </label>
      )}
      {!props.readOnly && kind !== "help" && (
        <button
          type="button"
          onClick={() => props.onChange({ ...entry, dropped: !entry.dropped })}
          className="mt-1 inline-flex min-h-11 items-center text-body-sm font-medium underline underline-offset-4"
        >
          {entry.dropped ? w["shots.dropped"] : w["shots.drop"]}
        </button>
      )}
    </li>
  );
}

/** What the thefts log took and why it left the rest out, with a link to the log. */
function SavedThefts({ saved, slug, w }: { saved: Saved; slug: string; w: Words }) {
  return (
    <div role="status" className="mt-3 border-l-4 border-plum pl-3">
      <p className="font-semibold">
        {fillIn(w["shots.theftsSaved"], { n: saved.saved, ...saved.left })}
      </p>
      <a
        href={`/w/${slug}/thefts`}
        className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
      >
        {w["shots.openThefts"]}
      </a>
    </div>
  );
}

function Victim(props: {
  members: DraftView["members"];
  value: number | null;
  onChange: (uid: number | null) => void;
  w: Words;
  readOnly: boolean;
}) {
  const { w } = props;
  return (
    <label className="mt-4 block" htmlFor="victim">
      <span className="font-semibold">{w["shots.victim"]}</span>
      <span className="block text-body-sm text-ink/80">{w["shots.victimHelp"]}</span>
      <select
        id="victim"
        value={props.value ?? ""}
        disabled={props.readOnly}
        onChange={(e) => props.onChange(e.target.value ? Number(e.target.value) : null)}
        className="mt-1 block min-h-11 w-full border border-rule bg-paper px-2"
      >
        <option value="">{w["shots.pickMember"]}</option>
        {props.members.map((m) => (
          <option key={m.uid} value={m.uid}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SecretOpsReview(props: {
  slug: string;
  view: DraftView;
  w: Words;
  kinds: Record<ImportKind, string>;
  saveKinds: ImportKind[];
  text: ReviewText;
}) {
  const { view, w, slug } = props;
  const router = useRouter();
  const [victim, setVictim] = useState<number | null>(view.victim);
  const [entries, setEntries] = useState<Entry[]>(
    view.rows.map((r) => ({ name: r.name, dropped: false })),
  );
  const [saved, setSaved] = useState<Saved | null>(null);
  const { busy, message, act } = useDraftActions(slug, view, w);
  const readOnly = view.status !== "open" || !view.canSave || saved !== null;
  const kept = entries.flatMap((e, row) => (e.dropped ? [] : [{ row, name: e.name.trim() }]));
  const ready =
    victim !== null && kept.every((e) => e.name !== "" || view.rows[e.row]?.entry?.kind === "help");

  async function save() {
    const report = { victimUid: victim, entries: kept };
    const answer = await act({
      action: "save",
      scope: null,
      day: null,
      weekBefore: false,
      rows: [],
      report,
    });
    if (answer.ok) {
      track("ws_draft_saved", { kind: view.kind });
      setSaved(answer.data.thefts as Saved);
    }
  }
  return (
    <>
      <DraftHeader
        {...props}
        choice={NO_CHOICE}
        set={{ scope: noop, day: noop, weekBefore: noop }}
        readOnly={readOnly}
        retype={(kind) =>
          void act({ action: "retype", kind, scope: null }).then((a) => a.ok && router.refresh())
        }
      />
      <Victim
        members={view.members}
        value={victim}
        onChange={setVictim}
        w={w}
        readOnly={readOnly}
      />
      <ul className="mt-4 space-y-2">
        {view.rows.map((row, i) => (
          <EntryCard
            key={`${i}-${row.name}`}
            i={i}
            row={row}
            entry={entries[i] as Entry}
            onChange={(next) => setEntries(entries.map((e, j) => (j === i ? next : e)))}
            w={w}
            readOnly={readOnly}
          />
        ))}
      </ul>
      <Message text={message} />
      {saved && <SavedThefts saved={saved} slug={slug} w={w} />}
      {!readOnly && (
        <Actions
          w={w}
          busy={busy}
          ready={ready}
          onSave={() => void save()}
          onDiscard={() => void act({ action: "discard" }).then((a) => a.ok && router.refresh())}
        />
      )}
    </>
  );
}
