"use client";

// The History tab's follow-up notes, each with its Delete (D123 phase 2), on the shared delete
// (DeleteRecord): "Keep it" first, Delete in seal; then "Note deleted." with Undo for a short while. The
// card is read again after a delete or an Undo, so the lines are what is stored.
import { useState } from "react";

import type { CardData } from "@/lib/private/member-card";
import { fill } from "@/lib/words";

import { DeleteButton, UndoLine } from "./DeleteRecord";
import { send } from "./follow-up-send";
import { SIGNED_OUT } from "./SignedOut";

/** One delete or its Undo: "ok", "not_found", SIGNED_OUT or "failed", as DeleteButton reads them. */
async function sendDelete(slug: string, body: object): Promise<string> {
  const r = await send(slug, { action: "delete", ...body });
  if (r?.status === 200) return "ok";
  if (r?.status === 401) return SIGNED_OUT;
  return r?.status === 404 ? "not_found" : "failed";
}

export function FollowUpNotes(props: {
  card: CardData;
  slug: string;
  onChanged?: (() => void) | undefined;
}) {
  const { uid } = props.card;
  const { head, lines, ids, words: t } = props.card.followUps;
  /** The officer's last delete, which the line offers to take back. */
  const [deleted, setDeleted] = useState<{ id: number; requestId: string } | null>(null);
  const undo = async () => {
    if (!deleted) return false;
    const body = { uid, id: deleted.id, requestId: deleted.requestId, undo: true };
    if ((await sendDelete(props.slug, body)) !== "ok") return false;
    setDeleted(null);
    props.onChanged?.();
    return true;
  };
  if (lines.length === 0 && !deleted) return null;
  return (
    <section className="mt-3">
      <h3 className="text-body-sm font-semibold">{head}</h3>
      {deleted && (
        <UndoLine
          key={deleted.requestId}
          done={t["card.followup.deleted"]}
          undo={t["followup.undo"]}
          failed={t["card.followup.deleteUndoFailed"]}
          onUndo={undo}
        />
      )}
      {/* ph-no-capture (issue 549): the notes and who wrote them never reach session replay. */}
      <ul className="ph-no-capture text-body-sm whitespace-pre-line">
        {lines.map((line, i) => {
          const id = ids[i] ?? 0;
          return (
            <li
              key={id}
              className="flex items-start justify-between gap-3 border-t border-rule py-1.5 tabular-nums"
            >
              <span className="min-w-0">{line}</span>
              <DeleteButton
                id={`follow-up-delete-${id}`}
                words={{
                  label: t["card.followup.delete"],
                  ask: t["card.followup.deleteAsk"],
                  confirm: t["card.followup.delete"],
                  deleting: t["card.followup.deleting"],
                  keep: t["card.followup.keep"],
                  failed: t["card.followup.deleteFailed"],
                }}
                ariaLabel={fill(t["card.followup.deleteName"], { line })}
                className="min-h-11 shrink-0 px-1 font-semibold text-seal underline underline-offset-4"
                send={(requestId) => sendDelete(props.slug, { uid, id, requestId })}
                onDeleted={(requestId) => {
                  // Someone else deleted it first: gone either way, with nothing of this officer's to undo.
                  setDeleted(requestId ? { id, requestId } : null);
                  props.onChanged?.();
                }}
              >
                <p className="mt-2 text-body-sm">{line}</p>
                <p className="mt-2 text-body-sm">{t["card.followup.deleteWhere"]}</p>
              </DeleteButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
