"use client";

// Archive and Delete at the foot of a roll call's page (issue 424, D120), on the shared delete (DeleteRecord,
// D123). Archive takes it off the week's list and keeps it under "Archived"; Unarchive brings it back. Delete
// asks first and replaces the page with the week's list, which says "Roll call deleted." with Undo; Undo
// names the same request id and brings the roll call back.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { chip } from "@/lib/brand/components/controls";

import { DeleteButton, UndoLine } from "./DeleteRecord";
import { sendRoll } from "./roll-call-client";
import type { RollSheetWords } from "./roll-call-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** "ok", SIGNED_OUT, "not_found" or "failed". */
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = `/w/${slug}/roll-call?week=${props.week}`;
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
        <DeleteButton
          id="roll-delete-ask"
          words={{
            label: t["roll.delete"],
            ask: t["roll.delete.ask"],
            confirm: t["roll.delete.confirm"],
            deleting: t["roll.delete.deleting"],
            keep: t["roll.delete.keep"],
            failed: t["roll.delete.failed"],
          }}
          send={(requestId) => send(slug, { action: "delete", id: props.id, requestId })}
          // The list replaces this page's own entry, so Back never lands on the deleted roll call's 404.
          // Someone else's delete first: it is gone either way, with nothing of this officer's to undo.
          onDeleted={(requestId) =>
            window.location.replace(
              requestId ? `${list}&deleted=${props.id}&undo=${requestId}` : list,
            )
          }
        >
          <p className="mt-3 font-subhead break-words">
            <bdi>{props.title}</bdi>
            <span className="block text-body-sm font-normal">{props.dayLabel}</span>
          </p>
          <p className="mt-2">{t["roll.delete.where"]}</p>
          {props.calendar && <p className="mt-2">{t["roll.delete.calendar"]}</p>}
        </DeleteButton>
      </div>
      {error && (
        <RefusalLine
          text={error}
          className="mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
    </section>
  );
}

/** The week list's line after a delete: "Roll call deleted." with Undo. */
export function RollCallDeletedLine(props: {
  slug: string;
  id: number;
  requestId: string;
  words: RollSheetWords;
}) {
  const { words: t, slug } = props;
  const router = useRouter();
  const undo = async () => {
    const body = { action: "delete", id: props.id, requestId: props.requestId, undo: true };
    if ((await send(slug, body)) !== "ok") return false;
    // The roll call takes this entry's place, so Back never shows a stale "Roll call deleted." with Undo.
    router.replace(`/w/${slug}/roll-call/mark?id=${props.id}`);
    return true;
  };
  return (
    <UndoLine
      done={t["roll.deleted"]}
      undo={t["roll.delete.undo"]}
      failed={t["roll.delete.undoFailed"]}
      onUndo={undo}
    />
  );
}
