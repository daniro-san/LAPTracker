"use client";

// Deleting a notice (issue 411, D118), on the shared delete (DeleteRecord, D123). "Delete notice" at the foot
// of a notice's page asks first: the question names the notice, says where it leaves, and that what was
// posted to Discord stays there. Delete replaces the page with the library, which says "Notice deleted."
// with Undo; Undo names the same request id and brings the notice back.
import { useRouter } from "next/navigation";

import { Notice } from "@/lib/brand/components/Notice";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { DeleteButton, UndoLine } from "./DeleteRecord";
import { sendDelete } from "./notice-client";

/** "Delete notice" at the foot of a notice's page. */
export function NoticeDelete(props: {
  slug: string;
  id: number;
  title: string;
  t: WorkspaceDictionary;
}) {
  const { t, slug } = props;
  return (
    <section className="mt-8 border-t border-rule pt-3">
      <DeleteButton
        id="notice-delete-ask"
        words={{
          label: t["notices.delete"],
          ask: t["notices.delete.ask"],
          confirm: t["notices.delete.confirm"],
          deleting: t["notices.delete.deleting"],
          keep: t["notices.delete.keep"],
          failed: t["notices.delete.failed"],
        }}
        send={(requestId) => sendDelete(slug, { id: props.id, requestId })}
        // The library replaces this page's own entry, so Back never lands on the deleted notice's 404.
        // Someone else's delete first: it is gone either way, with nothing of this officer's to undo.
        onDeleted={(requestId) =>
          window.location.replace(
            requestId
              ? `/w/${slug}/notices?deleted=${props.id}&undo=${requestId}`
              : `/w/${slug}/notices`,
          )
        }
      >
        <p className="mt-3 font-subhead break-words">
          <bdi>{props.title}</bdi>
        </p>
        <p className="mt-2">{t["notices.delete.where"]}</p>
        <Notice tone="info" className="mt-3">
          {t["notices.delete.discord"]}
        </Notice>
      </DeleteButton>
    </section>
  );
}

/** The library's line after a delete: "Notice deleted." with Undo. */
export function DeletedLine(props: {
  slug: string;
  id: number;
  requestId: string;
  t: WorkspaceDictionary;
}) {
  const { t, slug } = props;
  const router = useRouter();
  const undo = async () => {
    const answer = await sendDelete(slug, { id: props.id, requestId: props.requestId, undo: true });
    if (answer !== "ok") return false;
    // The notice takes this entry's place, so Back never shows a stale "Notice deleted." with Undo. (A
    // replace to the plain library then a push is cancelled by the push.)
    router.replace(`/w/${slug}/notices/${props.id}`);
    return true;
  };
  return (
    <UndoLine
      done={t["notices.deleted"]}
      undo={t["notices.undo"]}
      failed={t["notices.delete.undoFailed"]}
      onUndo={undo}
    />
  );
}
