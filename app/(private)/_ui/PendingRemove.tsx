"use client";

// Removing a new member added by hand (D106), on the shared delete (DeleteRecord, D123): Remove asks first
// ("Keep on list" is the main button, Remove follows in seal), the record is dismissed with who, when and the
// question's request id, and the list then says "Removed …" with Undo for a short while.
import { useRouter } from "next/navigation";

import { isolate } from "@/lib/copy";
import { fill } from "@/lib/words";

import { DeleteButton, UndoLine } from "./DeleteRecord";
import type { LifecycleWords, PendingRow } from "./member-lifecycle-data";
import { SIGNED_OUT } from "./SignedOut";

/** POST to the pending route: "ok", SIGNED_OUT, "not_found" or "failed". */
export async function sendPending(slug: string, body: object): Promise<string> {
  const res = await fetch(`/api/w/${slug}/pending`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return "ok";
  if (res?.status === 401) return SIGNED_OUT;
  return res?.status === 404 ? "not_found" : "failed";
}

/** The officer's last remove, which the list can take back while it offers Undo. */
export interface Removed {
  uid: number;
  name: string;
  requestId: string;
}

/** "Remove" in a new member's sheet; `onRemoved` runs once the question has closed. */
export function PendingRemove(props: {
  row: PendingRow;
  words: LifecycleWords;
  slug: string;
  onRemoved: (r: Removed | null) => void;
}) {
  const { row, words: t } = props;
  return (
    <DeleteButton
      id="pending-delete-ask"
      words={{
        label: t["pending.delete"],
        ask: fill(t["pending.deleteAsk"], { name: isolate(row.name) }),
        confirm: t["pending.delete"],
        deleting: t["pending.deleting"],
        keep: t["pending.keep"],
        failed: t["pending.failed"],
      }}
      send={(requestId) => sendPending(props.slug, { action: "delete", uid: row.uid, requestId })}
      // Someone else removed them first: gone either way, with nothing of this officer's to undo.
      onDeleted={(requestId) =>
        props.onRemoved(requestId ? { uid: row.uid, name: row.name, requestId } : null)
      }
    />
  );
}

/** The list's line after a remove: "Removed …." with Undo. */
export function PendingUndoLine(props: {
  removed: Removed;
  words: LifecycleWords;
  slug: string;
  onUndone: () => void;
}) {
  const { removed, words: t } = props;
  const router = useRouter();
  const undo = async () => {
    const body = { action: "delete", uid: removed.uid, requestId: removed.requestId, undo: true };
    if ((await sendPending(props.slug, body)) !== "ok") return false;
    props.onUndone();
    router.refresh();
    return true;
  };
  const name = { name: isolate(removed.name) };
  return (
    <UndoLine
      done={fill(t["pending.removed"], name)}
      undo={t["pending.undo"]}
      failed={fill(t["pending.undoFailed"], name)}
      onUndo={undo}
    />
  );
}
