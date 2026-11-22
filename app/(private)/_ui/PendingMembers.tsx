"use client";

// New members added by hand, waiting for the roster (D106), above the Members list: "Add a new member"
// (the facts editor with a name field), and each one waiting, tagged "New · waiting for tonight's roster".
// A row opens its sheet: the facts to edit like any member's ("Edit info" and "Paste what they told you"
// in the sticky bar), then "Link to a member" (the closest names first) and Remove, which asks first with
// the shared delete (DeleteRecord, D123), in the content: a bar holds two buttons; the list then offers Undo
// for a short while. On top, the ones "To match": a roster read since their add had
// no single match, each with "Link to a member". Below, "Dismissed": the deleted ones, kept with their
// info (2026-11-17). "Add a new member" is in the page head (PageActions, D122); a new member opens like
// any member, in the sheet below 1024 and in the pane beside the list from 1024 (MembersRoster).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { Sheet } from "@/lib/brand/components/Sheet";
import { Tag } from "@/lib/brand/components/Tag";
import { isolate } from "@/lib/copy";
import { NONE } from "@/lib/private/fact-text";
import { fill } from "@/lib/words";

import { FactsEditor } from "./FactsEditor";
import type { DismissedRow, LifecycleWords, PendingRow } from "./member-lifecycle-data";
import { Facts, factsActions, type EditorContext, type FactsMode } from "./MemberCards";
import { usePageAction } from "./PageActions";
import { PendingLink, type RosterName } from "./PendingLink";
import { PendingRemove, PendingUndoLine, sendPending, type Removed } from "./PendingRemove";
import { newRequestId } from "./request-id";
import { sheetWords } from "./sheet-words";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";

type Words = LifecycleWords;

/** Link or delete: one request, then the page reads again. */
function useAction(slug: string, onDone: () => void) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed" | typeof SIGNED_OUT>("idle");
  const run = async (body: object) => {
    setState("busy");
    const answer = await sendPending(slug, body);
    if (answer !== "ok") return setState(answer === SIGNED_OUT ? SIGNED_OUT : "failed");
    router.refresh();
    onDone();
  };
  return { state, run };
}

export function PendingSheet(props: {
  row: PendingRow;
  roster: RosterName[];
  words: Words;
  editor: EditorContext;
  onClose: () => void;
  onRemoved: (r: Removed | null) => void;
  /** Beside the list from 1024 (D122), not a dialog. */
  pane: boolean;
}) {
  const { row, words: t } = props;
  const router = useRouter();
  const [step, setStep] = useState<"link" | null>(null);
  const [mode, setMode] = useState<FactsMode>(null);
  const action = useAction(props.editor.slug, props.onClose);
  return (
    <Sheet
      pane={props.pane}
      labelledBy="pending-sheet-title"
      onCancel={props.onClose}
      title={<span translate="no">{isolate(row.name)}</span>}
      words={sheetWords(t)}
      {...factsActions(props.editor.words, setMode)}
    >
      <Tag>{t[row.toMatch ? "pending.toMatchTag" : "pending.tag"]}</Tag>
      {row.unmatched && <p className="mt-1 text-body-sm">{row.unmatched}</p>}
      <Facts
        card={row}
        editor={props.editor}
        zoneNow={null}
        mode={mode}
        onEditorClose={() => setMode(null)}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3">
        <button
          type="button"
          disabled={action.state === "busy"}
          onClick={() => setStep("link")}
          className={buttonClass("secondary")}
        >
          {t["pending.link"]}
        </button>
        <PendingRemove
          row={row}
          words={t}
          slug={props.editor.slug}
          onRemoved={(r) => {
            props.onRemoved(r);
            router.refresh();
            props.onClose();
          }}
        />
      </div>
      {action.state === "failed" && (
        <p role="alert" className="mt-2 font-semibold text-seal">
          {t["pending.failed"]}
        </p>
      )}
      {action.state === SIGNED_OUT && <SignedOutNote className="mt-2" />}
      {step === "link" && (
        <PendingLink
          name={row.name}
          roster={props.roster}
          words={t}
          onPick={(to) => {
            setStep(null);
            void action.run({ action: "link", uid: row.uid, to });
          }}
          onClose={() => setStep(null)}
        />
      )}
    </Sheet>
  );
}

/** The open row from 1024: tinted plum with a 3 px bar, as the table's open row (D122). */
export const OPEN_ROW = "bg-plum/15 shadow-[inset_3px_0_0_var(--plum)]";

/** One new member: their name and tag; a tap opens them. */
function Row({ row, words: t, open }: { row: PendingRow; words: Words; open: Open }) {
  const on = open.uid === row.uid;
  return (
    <button
      type="button"
      aria-haspopup={open.sheet ? "dialog" : undefined}
      aria-current={on ? "true" : undefined}
      data-uid={row.uid}
      onClick={() => open.onOpen(row.uid)}
      className={`${on ? OPEN_ROW : "tint-button"} flex min-h-14 w-full min-w-0 flex-col items-start justify-center px-2 py-1.5 text-left`}
    >
      <span translate="no" className="max-w-full truncate font-semibold">
        <bdi>{row.name}</bdi>
      </span>
      <Tag>{t[row.toMatch ? "pending.toMatchTag" : "pending.tag"]}</Tag>
    </button>
  );
}

/** "2 new members to match" on top: a roster read since their add had no single match. */
function ToMatch(props: {
  rows: PendingRow[];
  line: string;
  roster: RosterName[];
  words: Words;
  slug: string;
  open: Open;
}) {
  const { words: t } = props;
  const [linking, setLinking] = useState<number | null>(null);
  const link = useAction(props.slug, () => setLinking(null));
  const toLink = props.rows.find((r) => r.uid === linking);
  if (props.rows.length === 0) return null;
  return (
    <section aria-labelledby="to-match" className="mt-2 border-l-4 border-yarn pl-3">
      <h3 id="to-match" className="scroll-mt-20 font-semibold">
        {props.line}
      </h3>
      <p className="text-body-sm">{t["pending.toMatchHelp"]}</p>
      <ul className="mt-1">
        {props.rows.map((r) => (
          <li key={r.uid} className="flex items-center gap-2 border-t border-rule">
            <div className="min-w-0 flex-1">
              <Row row={r} words={t} open={props.open} />
            </div>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setLinking(r.uid)}
              className={buttonClass("secondary", "shrink-0")}
            >
              {t["pending.link"]}
            </button>
          </li>
        ))}
      </ul>
      {link.state === "failed" && (
        <p role="alert" className="mt-2 font-semibold text-seal">
          {t["pending.failed"]}
        </p>
      )}
      {link.state === SIGNED_OUT && <SignedOutNote className="mt-2" />}
      {toLink && (
        <PendingLink
          name={toLink.name}
          roster={props.roster}
          words={t}
          onPick={(to) => void link.run({ action: "link", uid: toLink.uid, to })}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  );
}

/** Removed new members, kept with their info (2026-11-17), closed until opened; "Bring back" adds the
 * name again, which reopens the record. */
function Dismissed({ rows, words: t, slug }: { rows: DismissedRow[]; words: Words; slug: string }) {
  const back = useAction(slug, () => undefined);
  if (rows.length === 0) return null;
  return (
    <details className="mt-3">
      {/* A list-item summary keeps the open/closed marker. */}
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold">
        {fill(t["pending.dismissed"], { n: rows.length })}
      </summary>
      <p className="text-body-sm text-ink/80">{t["pending.dismissedHelp"]}</p>
      <ul className="mt-1">
        {rows.map((r) => (
          <li key={r.uid} className="border-t border-rule px-1 py-1.5">
            <p className="flex items-baseline gap-2">
              <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
                <bdi>{r.name}</bdi>
              </span>
              <span className="shrink-0 text-body-sm text-ink/80">{r.dismissedOn}</span>
            </p>
            {r.summary && <p className="text-body-sm text-ink/75">{r.summary}</p>}
            <button
              type="button"
              disabled={back.state === "busy"}
              onClick={() =>
                void back.run({
                  action: "add",
                  requestId: newRequestId(),
                  name: r.name,
                  changes: [],
                })
              }
              className={`${chip()} mt-1`}
            >
              {t["pending.bringBack"]}
            </button>
          </li>
        ))}
      </ul>
      {back.state === "failed" && (
        <p role="alert" className="mt-2 font-semibold text-seal">
          {t["pending.failed"]}
        </p>
      )}
      {back.state === SIGNED_OUT && <SignedOutNote className="mt-2" />}
    </details>
  );
}

/** The open member (the roster's), whether a row opens a sheet, and how to open one. */
interface Open {
  uid: number | null;
  sheet: boolean;
  onOpen: (uid: number) => void;
}

export interface PendingProps {
  rows: PendingRow[];
  /** "2 new members need linking", in the officer's language. */
  toMatchLine: string;
  dismissed: DismissedRow[];
  roster: RosterName[];
  words: Words;
  editor: EditorContext;
}

export function PendingMembers(
  props: PendingProps & {
    open: Open;
    /** The one just removed, with Undo for a short while. */
    removed: Removed | null;
    onUndone: () => void;
  },
) {
  const { rows, words: t, removed } = props;
  const [adding, closeAdd] = usePageAction("add-member");
  const waiting = rows.filter((r) => !r.toMatch);
  return (
    <section aria-labelledby={rows.length > 0 ? "pending-head" : undefined} className="mt-4">
      {rows.length > 0 && (
        <h2 id="pending-head" className="font-subhead text-display-sm">
          {t["pending.head"]}
        </h2>
      )}
      <ToMatch
        rows={rows.filter((r) => r.toMatch)}
        line={props.toMatchLine}
        roster={props.roster}
        words={t}
        slug={props.editor.slug}
        open={props.open}
      />
      {waiting.length > 0 && (
        <ul className="mt-1">
          {waiting.map((r) => (
            <li key={r.uid} className="border-t border-rule">
              <Row row={r} words={t} open={props.open} />
            </li>
          ))}
        </ul>
      )}
      {removed && (
        <PendingUndoLine
          key={removed.requestId}
          {...{ removed, words: t, slug: props.editor.slug }}
          onUndone={props.onUndone}
        />
      )}
      <Dismissed rows={props.dismissed} words={t} slug={props.editor.slug} />
      {adding && (
        <FactsEditor
          {...props.editor}
          uid={null}
          name=""
          facts={{}}
          autoStatus={NONE}
          mode="edit"
          members={props.roster}
          onClose={closeAdd}
        />
      )}
    </section>
  );
}
