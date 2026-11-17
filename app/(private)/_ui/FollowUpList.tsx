"use client";

// The Follow-up tab's list (issue 340, D104): the members to look at under "Check in" and "New", each with
// one-tap "Talked to them", "Add a note" and a link to Members. "Add a note" opens a sheet with four answers
// (FollowUpSheet.tsx). Every save carries a request id (D100). After a save the page is read again, the
// member leaves the list, and a line says until when, with Undo: Undo appends a "withdrawn" record, so the
// log stays append-only and the member is back on the list.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import { fill, isolate } from "@/lib/copy";

import type { FollowUpWords } from "./follow-up-words";
import { RecordSheet, send, type FollowUpRow } from "./FollowUpSheet";

export type { FollowUpRow };

export interface FollowUpGroup {
  id: string;
  title: string;
  rows: FollowUpRow[];
}

/** What the last save did, for the line with Undo. */
type Done = { uid: number; name: string; requestId: string; state: "saved" | "undone" | "failed" };

function DoneLine(props: { done: Done | null; words: FollowUpWords; onUndo: () => void }) {
  const { done, words } = props;
  const name = done ? isolate(done.name) : "";
  const text = !done
    ? ""
    : done.state === "saved"
      ? fill(words["followup.saved"], { name })
      : done.state === "undone"
        ? fill(words["followup.undone"], { name })
        : words["followup.undoFailed"];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
      {done && (
        <p role="status" className="text-body-sm font-semibold text-sage">
          {text}
        </p>
      )}
      {done?.state === "saved" && (
        <button type="button" onClick={props.onUndo} className={chip()}>
          {words["followup.undo"]}
        </button>
      )}
    </div>
  );
}

function Row(props: {
  row: FollowUpRow;
  slug: string;
  words: FollowUpWords;
  busy: boolean;
  onTalked: () => void;
  onNote: () => void;
}) {
  const { row, words } = props;
  return (
    <li className="border-t border-rule py-3">
      <p className="font-semibold">
        <bdi translate="no">{row.name}</bdi>
        {row.rank && <span className="font-normal text-ink/75">{` · ${row.rank}`}</span>}
        {row.tag && <span className="ml-2 text-[12px] font-semibold text-yarn">{row.tag}</span>}
      </p>
      {row.lines.map((line) => (
        <p key={line} className="text-body-sm">
          {line}
        </p>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={props.busy} onClick={props.onTalked} className={chip()}>
          {words["followup.talkedNow"]}
        </button>
        <button type="button" onClick={props.onNote} className={chip()}>
          {words["followup.record"]}
        </button>
        <a
          href={`/w/${props.slug}/members?q=${encodeURIComponent(row.name)}`}
          aria-label={fill(words["followup.inMembersAria"], { name: isolate(row.name) })}
          className="inline-flex min-h-11 items-center px-1 text-body-sm font-semibold text-plum underline underline-offset-4"
        >
          {words["followup.inMembers"]}
        </a>
      </div>
    </li>
  );
}

export function FollowUpList(props: {
  slug: string;
  groups: FollowUpGroup[];
  today: string;
  language: string;
  words: FollowUpWords;
}) {
  const { words, slug } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FollowUpRow | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const saved = (row: FollowUpRow, requestId: string) => {
    setDone({ uid: row.uid, name: row.name, requestId, state: "saved" });
    router.refresh();
  };
  const talked = async (row: FollowUpRow) => {
    const requestId = crypto.randomUUID();
    setBusy(row.uid);
    const body = { uid: row.uid, action: "talked", note: "", until: null, version: 0, requestId };
    const r = await send(slug, body);
    setBusy(null);
    if (r?.status === 200) saved(row, requestId);
  };
  const undo = async () => {
    if (!done) return;
    const r = await send(slug, {
      uid: done.uid,
      action: "undo",
      target: done.requestId,
      requestId: crypto.randomUUID(),
    });
    setDone({ ...done, state: r?.status === 200 ? "undone" : "failed" });
    router.refresh();
  };
  return (
    <>
      <DoneLine done={done} words={words} onUndo={undo} />
      {props.groups.map((g) => (
        <section key={g.id} className="mt-4" aria-labelledby={`follow-up-${g.id}`}>
          <h2 id={`follow-up-${g.id}`} className="font-subhead text-display-sm">
            {g.title}
          </h2>
          <ul className="mt-1">
            {g.rows.map((row) => (
              <Row
                key={row.uid}
                row={row}
                slug={slug}
                words={words}
                busy={busy === row.uid}
                onTalked={() => void talked(row)}
                onNote={() => {
                  setDone(null);
                  setOpen(row);
                }}
              />
            ))}
          </ul>
        </section>
      ))}
      {open && (
        <RecordSheet
          slug={slug}
          row={open}
          today={props.today}
          language={props.language}
          words={words}
          onClose={() => setOpen(null)}
          onSaved={(requestId) => {
            saved(open, requestId);
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
