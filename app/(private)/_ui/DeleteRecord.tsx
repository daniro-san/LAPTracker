"use client";

// The one delete every officer-owned record uses (D123, from D118 and D120). `DeleteButton`: a text button in
// seal that asks first (AskSheet, DESIGN.md "Question": "Keep it" is the main button and has the focus,
// Delete follows in seal), sends once under the question's request id (D100), and answers after the question
// has closed. `UndoLine`: "… deleted." with Undo for UNDO_SHOWN_MS; the server takes it back for a while
// longer (UNDO_MS).
import { useEffect, useRef, useState, type ReactNode } from "react";

import { chip } from "@/lib/brand/components/controls";

import { AskSheet } from "./AskSheet";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** How long a page offers Undo after a delete. */
export const UNDO_SHOWN_MS = 10_000;

/** The question's words, in the officer's language. */
export interface DeleteWords {
  /** The button: "Delete notice". */
  label: string;
  /** "Delete this notice?" */
  ask: string;
  confirm: string;
  deleting: string;
  keep: string;
  /** "Could not delete the notice. Try again." */
  failed: string;
}

/**
 * The button and its question. `onDeleted` runs once the question has closed (its own history entry is
 * stepped off first, so a page replaced there never lands on the question's entry): with the request id
 * after this officer's delete, or null when someone else deleted it first (nothing of theirs to undo).
 */
export function DeleteButton(props: {
  id: string;
  words: DeleteWords;
  /** "ok"; "not_found" when it is already gone (someone else deleted it); SIGNED_OUT; else it failed. */
  send: (requestId: string) => Promise<string>;
  onDeleted: (requestId: string | null) => void;
  /** What the question says under it: which record, where it leaves. */
  children?: ReactNode;
  /** The button's look when it is not the seal text button (a Calendar day card's quiet Delete). */
  className?: string;
  /** The button's accessible name when its label alone does not say which record ("Delete: Bear hunt"). */
  ariaLabel?: string;
}) {
  const { words: t } = props;
  /** The open question's request id (D100), new for each opening; null when closed. */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async (requestId: string) => {
    setBusy(true);
    setError(null);
    const answer = await props.send(requestId);
    if (answer === "ok" || answer === "not_found") {
      const done = answer === "ok" ? requestId : null;
      window.addEventListener("popstate", () => props.onDeleted(done), { once: true });
    } else {
      setBusy(false);
      setError(answer === SIGNED_OUT ? SIGNED_OUT : t.failed);
    }
    setAsking(null);
  };
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={props.ariaLabel}
        onClick={() => {
          setBusy(false);
          setAsking(newRequestId());
        }}
        className={
          props.className ?? "min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
        }
      >
        {t.label}
      </button>
      {error && (
        <RefusalLine
          text={error}
          // Its own line, also inside a row of buttons.
          className="mt-2 basis-full border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
      {asking !== null && (
        <AskSheet
          id={props.id}
          question={t.ask}
          yes={busy ? t.deleting : t.confirm}
          no={t.keep}
          seal
          busy={busy}
          onAnswer={(yes) => {
            if (yes) void remove(asking);
            else if (!busy) setAsking(null);
          }}
        >
          {props.children}
        </AskSheet>
      )}
    </>
  );
}

/**
 * The line after a delete: `done` ("Notice deleted.") with Undo, which goes after UNDO_SHOWN_MS. `onUndo`
 * sends the Undo and is true when it worked (the caller then shows the record again); false says `failed`.
 */
export function UndoLine(props: {
  done: string;
  undo: string;
  failed: string;
  onUndo: () => Promise<boolean>;
}) {
  const [state, setState] = useState<"shown" | "busy" | "failed" | "closed">("shown");
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The delete may have been made further down a long page (a Calendar day card): bring it in view.
    line.current?.scrollIntoView({ block: "nearest" });
    const timer = setTimeout(() => setState((s) => (s === "shown" ? "closed" : s)), UNDO_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);
  const undo = async () => {
    setState("busy");
    if (!(await props.onUndo())) setState("failed");
  };
  return (
    <div
      ref={line}
      className="mt-4 flex min-h-11 scroll-mt-4 flex-wrap items-center gap-x-3 gap-y-1"
    >
      <p role="status" className="text-body-sm font-semibold text-sage">
        {state === "failed" ? props.failed : props.done}
      </p>
      {(state === "shown" || state === "busy") && (
        <button
          type="button"
          disabled={state === "busy"}
          onClick={() => void undo()}
          className={chip()}
        >
          {props.undo}
        </button>
      )}
    </div>
  );
}
