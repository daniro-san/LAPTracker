"use client";

// A Secret Ops report under review (issues 299, 321): the report never says whose it is, so the officer
// picks the member who was robbed (their own player first, when "This is me" is set, with a line saying
// so; otherwise nobody until chosen). Each entry shows what the sentence said and when, with its attacker's name to fix or
// the row to drop. Save hands the entries to the thefts log (D97) and says how many it saved and, for the
// reasons that apply, how many were left out, with a link to the log. Help lines are shown and never saved.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { FIELD } from "@/lib/brand/components/controls";
import type { ImportKind } from "@/lib/private/import-kinds";
import type { DraftView } from "@/lib/private/import-view";
import { fill } from "@/lib/words";

import { Actions, confirmRetype, Message, useDraftActions, type Why } from "./draft-actions";
import type { Words } from "./draft-known";
import { DraftHeader, type ReviewText } from "./DraftHeader";

interface Entry {
  name: string;
  /** What was taken, typed from the report's item pictures, which the OCR cannot read (D97). */
  items: string;
  dropped: boolean;
}

type Saved = { saved: number; left: { help: number; own: number; duplicate: number } };

/** A report has no tab, day or week to choose. */
const NO_CHOICE = { scope: null, day: "sat", weekBefore: false } as const;
const noop = () => undefined;
/** A report saves no ranking rows, tab, day or week. */
const NO_ROWS = { scope: null, day: null, weekBefore: false, rows: [] };

const KIND_WORD = { theft: "shots.entry.theft", help: "shots.entry.help" } as const;

/** "Theft · 14:02": the entry's kind and, when read, its time. */
const entryHead = (w: Words, kind: keyof typeof KIND_WORD | null, at: string | null | undefined) =>
  `${w[kind ? KIND_WORD[kind] : "shots.entry.unknown"] ?? ""}${at ? ` · ${fill(w["shots.at"] ?? "", { at })}` : ""}`;

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
  return (
    <li className={`border border-rule px-3 py-3 ${entry.dropped ? "border-dashed" : ""}`}>
      <p className="text-body-sm">{entryHead(w, kind, row.entry?.at)}</p>
      {!entry.dropped && kind !== "help" && (
        <>
          <label className="mt-1 block text-body-sm" htmlFor={`entry-${props.i}`}>
            {w["shots.attacker"]}
            <input
              id={`entry-${props.i}`}
              value={entry.name}
              maxLength={64}
              translate="no"
              disabled={props.readOnly}
              onChange={(e) => props.onChange({ ...entry, name: e.target.value })}
              className={`${FIELD} mt-1 block`}
            />
          </label>
          <label className="mt-2 block text-body-sm" htmlFor={`items-${props.i}`}>
            {w["shots.items"]}
            <input
              id={`items-${props.i}`}
              value={entry.items}
              maxLength={200}
              disabled={props.readOnly}
              onChange={(e) => props.onChange({ ...entry, items: e.target.value })}
              className={`${FIELD} mt-1 block`}
            />
          </label>
        </>
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

/** "Saved 4 thefts. Left out: 1 help, 2 already in the log." — only the reasons that apply. */
function SavedThefts({
  saved,
  slug,
  w,
  link,
}: {
  saved: Saved;
  slug: string;
  w: Words;
  /** D126: false while the thefts log is turned off for the alliance. */
  link: boolean;
}) {
  const n = saved.saved;
  const list = (["help", "own", "duplicate"] as const)
    .filter((k) => saved.left[k] > 0)
    .map((k) => fill(w[`shots.left.${k}`] ?? "", { n: saved.left[k] }))
    .join(", ");
  return (
    <div role="status" className="mt-3 border-l-4 border-plum pl-3">
      <p className="font-semibold">
        {fill(w[n === 1 ? "shots.theftsSaved.one" : "shots.theftsSaved.other"] ?? "", { n })}
        {list && ` ${fill(w["shots.leftOut.list"] ?? "", { list })}`}
      </p>
      {link && (
        <a
          href={`/w/${slug}/thefts`}
          className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
        >
          {w["shots.openThefts"]}
        </a>
      )}
    </div>
  );
}

function Victim(props: {
  members: DraftView["members"];
  value: number | null;
  /** The officer's own player, preselected by "This is me". */
  you: number | null;
  onChange: (uid: number | null) => void;
  w: Words;
  readOnly: boolean;
}) {
  const { w } = props;
  return (
    <label className="mt-4 block" htmlFor="victim">
      <span className="font-semibold">{w["shots.victim"]}</span>
      <span className="block text-body-sm text-ink/80">{w["shots.victimHelp"]}</span>
      {props.value !== null && props.value === props.you && (
        <span className="mt-1 block border-l-4 border-yarn pl-2 text-body-sm">
          {w["shots.victimYou"]}
        </span>
      )}
      <select
        id="victim"
        value={props.value ?? ""}
        disabled={props.readOnly}
        onChange={(e) => props.onChange(e.target.value ? Number(e.target.value) : null)}
        className={`${FIELD} mt-1 block`}
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

/** Why Save is off: no victim yet, or a theft kept without its attacker's name. */
function whyNot(
  view: DraftView,
  victim: number | null,
  kept: { row: number; name: string }[],
  w: Words,
): Why | null {
  if (victim === null) return { template: w["shots.why.victim"] };
  const nameless = kept.find((e) => e.name === "" && view.rows[e.row]?.entry?.kind !== "help");
  if (!nameless) return null;
  const row = { label: `#${nameless.row + 1}`, href: `#entry-${nameless.row}` };
  return { template: w["shots.why.attacker"], row };
}

export function SecretOpsReview(props: {
  slug: string;
  view: DraftView;
  w: Words;
  kinds: Record<ImportKind, string>;
  saveKinds: ImportKind[];
  text: ReviewText;
  thefts: boolean;
}) {
  const { view, w, slug } = props;
  const router = useRouter();
  const [victim, setVictim] = useState<number | null>(view.victim);
  const [entries, setEntries] = useState<Entry[]>(
    view.rows.map((r) => ({ name: r.name, items: "", dropped: false })),
  );
  const [saved, setSaved] = useState<Saved | null>(null);
  const { busy, message, act } = useDraftActions(slug, view, w);
  const readOnly = view.status !== "open" || !view.canSave || saved !== null;
  const kept = entries.flatMap((e, row) =>
    e.dropped ? [] : [{ row, name: e.name.trim(), items: e.items.trim() }],
  );
  const why = whyNot(view, victim, kept, w);
  const touched =
    victim !== view.victim ||
    entries.some((e, i) => e.dropped || e.items !== "" || e.name !== view.rows[i]?.name);

  async function save() {
    const report = { victimUid: victim, entries: kept };
    const answer = await act({ action: "save", ...NO_ROWS, report });
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
          confirmRetype(touched, w) &&
          void act({ action: "retype", kind, scope: null }).then((a) => a.ok && router.refresh())
        }
      />
      <Victim
        members={view.members}
        value={victim}
        you={view.victim}
        onChange={setVictim}
        w={w}
        readOnly={readOnly}
      />
      <ul className="mt-4 space-y-2" data-unsaved={touched && !readOnly ? "" : undefined}>
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
      {saved && <SavedThefts saved={saved} slug={slug} w={w} link={props.thefts} />}
      {!readOnly && (
        <Actions
          w={w}
          busy={busy}
          why={why}
          onSave={() => void save()}
          onDiscard={() => void act({ action: "discard" }).then((a) => a.ok && router.refresh())}
        />
      )}
    </>
  );
}
