"use client";

// The Follow-up tab's list (issue 340, D104): the members to look at under "Check in", "New" and "A tip to
// share" (D140), each with one-tap "Talked to them", "Add a note" and a link to Members. A tap on the
// person, or "Add a note", opens their panel (FollowUpSheet.tsx): a sheet below 1024, the pane beside the
// list from 1024, the open one in the address (`?m=`, D122). Every save carries a request id (D100). After
// a save the page is read again, the member leaves the list, and a line says until when, with Undo: Undo
// appends a "withdrawn" record, so the log stays append-only and the member is back on the list.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { chip } from "@/lib/brand/components/controls";
import { MasterDetail } from "@/lib/brand/components/layout/MasterDetail";
import { fill, isolate } from "@/lib/copy";

import type { FollowUpWords } from "./follow-up-words";
import { FollowUpPanel, send, type FollowUpRow } from "./FollowUpSheet";
import type { EditorContext } from "./MemberCards";
import { shown, useOpenMember } from "./open-member";
import { OPEN_ROW } from "./PendingMembers";
import { newRequestId } from "./request-id";

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
  open: boolean;
  /** Below 1024 the panel is a dialog. */
  sheet: boolean;
  onTalked: () => void;
  onOpen: () => void;
}) {
  const { row, words } = props;
  return (
    <li className="border-t border-rule pb-3">
      {/* The person is the way into their panel: why, the message, what to fill in, how it went. Its name is
          what it shows (the name and the reasons, WCAG 2.5.3); what it opens is its description (issue 585). */}
      <span id={`fu-hint-${row.uid}`} className="sr-only">
        {words["followup.openHint"]}
      </span>
      <button
        type="button"
        data-uid={row.uid}
        aria-haspopup={props.sheet ? "dialog" : undefined}
        aria-current={props.open ? "true" : undefined}
        aria-describedby={`fu-hint-${row.uid}`}
        onClick={props.onOpen}
        className={`${props.open ? OPEN_ROW : "tint-button"} -mx-2 block min-h-11 w-[calc(100%+1rem)] px-2 pt-3 pb-1 text-left`}
      >
        <span className="block font-semibold">
          <bdi translate="no">{row.name}</bdi>
          {row.rank && <span className="font-normal text-ink/75">{` · ${row.rank}`}</span>}
          {row.tag && <span className="ml-2 text-[12px] font-semibold text-yarn">{row.tag}</span>}
        </span>
        {row.lines.map((line) => (
          // ph-no-capture (issue 549): the reasons and the coins tip never reach session replay.
          <span key={line} className="ph-no-capture block text-body-sm">
            {line}
          </span>
        ))}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={props.busy} onClick={props.onTalked} className={chip()}>
          {words["followup.talkedNow"]}
        </button>
        <button type="button" onClick={props.onOpen} className={chip()}>
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

/** A group of the week's list, in the drawn card (D116). */
const GROUP = "drawn-card mt-4 px-4 pt-3";

/** One-tap "Talked to them", a save from the panel, and Undo, with the line that says what happened. */
function useSaves(slug: string) {
  const router = useRouter();
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const saved = (row: FollowUpRow, requestId: string) => {
    setDone({ uid: row.uid, name: row.name, requestId, state: "saved" });
    router.refresh();
  };
  const talked = async (row: FollowUpRow) => {
    const requestId = newRequestId();
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
      requestId: newRequestId(),
    });
    setDone({ ...done, state: r?.status === 200 ? "undone" : "failed" });
    router.refresh();
  };
  return { done, setDone, busy, saved, talked, undo };
}

/**
 * The open row as last seen: facts filled in the panel can take the member off the list while it is
 * open, and the panel (with its editor) stays until the officer closes it.
 */
function useOpenRow(groups: FollowUpGroup[], open: number | null) {
  const found = groups.flatMap((g) => g.rows).find((r) => r.uid === open);
  const [kept, setKept] = useState<FollowUpRow | null>(null);
  if (found && found !== kept) setKept(found);
  return found ?? (kept?.uid === open ? kept : undefined);
}

export function FollowUpList(props: {
  slug: string;
  groups: FollowUpGroup[];
  today: string;
  language: string;
  words: FollowUpWords;
  editor: EditorContext;
  /** `?m=` when the page was opened. */
  initialOpen: string | null;
  /** After the list, in its column (the thefts): nothing follows the list and its pane (D122). */
  foot: ReactNode;
}) {
  const { words, slug } = props;
  const at = useOpenMember(props.initialOpen);
  const { done, setDone, busy, saved, talked, undo } = useSaves(slug);
  const row = useOpenRow(props.groups, at.open);
  const panel = (pane: boolean) =>
    row && (
      <FollowUpPanel
        key={row.uid}
        pane={pane}
        slug={slug}
        row={row}
        today={props.today}
        language={props.language}
        words={words}
        editor={props.editor}
        onClose={() => {
          at.close();
          if (pane) shown(`[data-uid="${row.uid}"]`)?.focus();
        }}
        onSaved={(requestId) => {
          saved(row, requestId);
          at.close();
        }}
      />
    );
  const list = (
    <>
      <DoneLine done={done} words={words} onUndo={undo} />
      {props.groups.map((g) => (
        <section key={g.id} className={GROUP} aria-labelledby={`follow-up-${g.id}`}>
          <h2 id={`follow-up-${g.id}`} className="font-subhead text-display-sm">
            {g.title}
          </h2>
          <ul className="mt-1">
            {g.rows.map((r) => (
              <Row
                key={r.uid}
                row={r}
                slug={slug}
                words={words}
                busy={busy === r.uid}
                open={r.uid === at.open}
                sheet={at.wide !== true}
                onTalked={() => void talked(r)}
                onOpen={() => {
                  setDone(null);
                  at.show(r.uid);
                }}
              />
            ))}
          </ul>
        </section>
      ))}
      {props.foot}
    </>
  );
  // With nobody on the list there is nothing to pick: the list alone, so no "Pick someone" line.
  if (props.groups.length === 0 && !row) return list;
  return (
    <>
      <MasterDetail
        list={list}
        detail={at.wide ? (panel(true) ?? null) : null}
        {...(row && { detailLabel: row.name })}
        empty={words["followup.pick"]}
      />
      {at.wide === false && panel(false)}
    </>
  );
}
