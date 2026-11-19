"use client";

// Archive and Delete at the foot of a roll call's page (issue 424, D120), as a notice's delete (D118). Archive
// takes it off the week's list and keeps it under "Archived"; Unarchive brings it back. Delete asks first
// (AskSheet: "Keep it" is the main button and has the focus, Delete follows in seal), sends once under the
// question's request id (D100), and replaces the page with the week's list, which says "Roll call deleted."
// with Undo for UNDO_SHOWN_MS; Undo names the same request id and brings the roll call back.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { chip } from "@/lib/brand/components/controls";

import { AskSheet } from "./AskSheet";
import { newRequestId } from "./request-id";
import { sendRoll } from "./roll-call-client";
import type { RollSheetWords } from "./roll-call-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** How long the list offers Undo; the server takes it back for a while longer (UNDO_MS). */
const UNDO_SHOWN_MS = 10_000;

/** "ok", SIGNED_OUT, or "failed". */
async function send(slug: string, body: object): Promise<string> {
  const { status, json } = await sendRoll(slug, body);
  if (status === 200) return "ok";
  if (status === 401) return SIGNED_OUT;
  return json.code === "not_found" ? "not_found" : "failed";
}

export function RollCallManage(props: {
  slug: string;
  id: number;
  title: string;
  dayLabel: string;
  week: string;
  /** From a Calendar entry that is still there: the question says the entry stays. */
  calendar: boolean;
  archived: boolean;
  words: RollSheetWords;
}) {
  const { words: t, slug } = props;
  const router = useRouter();
  /** The open question's request id (D100), new for each opening; null when closed. */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = `/w/${slug}/roll-call?week=${props.week}`;
  // The list replaces this page's own entry, so Back never lands on the deleted roll call's 404. The open
  // question owns one more entry (sheet-close.ts): closing it steps back off that entry first, and the
  // full load waits for it.
  const leave = (to: string) => {
    window.addEventListener("popstate", () => window.location.replace(to), { once: true });
    setAsking(null);
  };
  const remove = async (requestId: string) => {
    setBusy(true);
    setError(null);
    const answer = await send(slug, { action: "delete", id: props.id, requestId });
    // Someone else deleted it first: it is gone either way, with nothing of this officer's to undo.
    if (answer === "not_found") return leave(list);
    if (answer === "ok") return leave(`${list}&deleted=${props.id}&undo=${requestId}`);
    setBusy(false);
    setAsking(null);
    setError(answer === SIGNED_OUT ? SIGNED_OUT : t["roll.delete.failed"]);
  };
  const archive = async () => {
    setBusy(true);
    setError(null);
    const answer = await send(slug, { action: "archive", id: props.id, on: !props.archived });
    setBusy(false);
    if (answer === "ok") return router.refresh();
    setError(answer === SIGNED_OUT ? SIGNED_OUT : t["roll.archive.failed"]);
  };
  return (
    <section className="mt-8 border-t border-rule pt-3">
      {!props.archived && <p className="text-body-sm text-ink/80">{t["roll.archive.hint"]}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" disabled={busy} onClick={() => void archive()} className={chip()}>
          {t[props.archived ? "roll.unarchive" : "roll.archive"]}
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAsking(newRequestId())}
          className="min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
        >
          {t["roll.delete"]}
        </button>
      </div>
      {error && (
        <RefusalLine
          text={error}
          className="mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
      {asking !== null && (
        <DeleteQuestion
          {...props}
          busy={busy}
          onAnswer={(yes) => {
            if (yes) void remove(asking);
            else if (!busy) setAsking(null);
          }}
        />
      )}
    </section>
  );
}

/** "Delete this roll call?": which one, where it leaves, and that a Calendar entry stays. */
function DeleteQuestion(props: {
  title: string;
  dayLabel: string;
  calendar: boolean;
  busy: boolean;
  words: RollSheetWords;
  onAnswer: (yes: boolean) => void;
}) {
  const { words: t, busy } = props;
  return (
    <AskSheet
      id="roll-delete-ask"
      question={t["roll.delete.ask"]}
      yes={busy ? t["roll.delete.deleting"] : t["roll.delete.confirm"]}
      no={t["roll.delete.keep"]}
      seal
      busy={busy}
      onAnswer={props.onAnswer}
    >
      <p className="mt-3 font-subhead break-words">
        <bdi>{props.title}</bdi>
        <span className="block text-body-sm font-normal">{props.dayLabel}</span>
      </p>
      <p className="mt-2">{t["roll.delete.where"]}</p>
      {props.calendar && <p className="mt-2">{t["roll.delete.calendar"]}</p>}
    </AskSheet>
  );
}

/** The week list's line after a delete: "Roll call deleted." with Undo, gone after UNDO_SHOWN_MS. */
export function RollCallDeletedLine(props: {
  slug: string;
  id: number;
  requestId: string;
  words: RollSheetWords;
}) {
  const { words: t, slug } = props;
  const router = useRouter();
  const [state, setState] = useState<"shown" | "busy" | "failed" | "closed">("shown");
  useEffect(() => {
    const timer = setTimeout(() => setState((s) => (s === "shown" ? "closed" : s)), UNDO_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);
  const undo = async () => {
    setState("busy");
    const body = { action: "delete", id: props.id, requestId: props.requestId, undo: true };
    if ((await send(slug, body)) !== "ok") return setState("failed");
    // The roll call takes this entry's place, so Back never shows a stale "Roll call deleted." with Undo.
    router.replace(`/w/${slug}/roll-call/mark?id=${props.id}`);
  };
  return (
    <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" className="text-body-sm font-semibold text-sage">
        {state === "failed" ? t["roll.delete.undoFailed"] : t["roll.deleted"]}
      </p>
      {(state === "shown" || state === "busy") && (
        <button
          type="button"
          disabled={state === "busy"}
          onClick={() => void undo()}
          className={chip()}
        >
          {t["roll.delete.undo"]}
        </button>
      )}
    </div>
  );
}
