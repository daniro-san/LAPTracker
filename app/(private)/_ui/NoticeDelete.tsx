"use client";

// Deleting a notice (issue 411, D118). "Delete notice" at the foot of a notice's page asks first: the
// question names the notice, says where it leaves, and that what was posted to Discord stays there. Delete
// sends once (a request id per opened question, D100) and replaces the page with the library, which says
// "Notice deleted." with Undo for UNDO_SHOWN_MS; Undo names the same request id and brings the notice back.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { AskSheet } from "./AskSheet";
import { sendDelete } from "./notice-client";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** How long the library offers Undo; the server takes it back for a while longer (UNDO_MS). */
const UNDO_SHOWN_MS = 10_000;

/**
 * "Delete notice" at the foot of a notice's page. It asks first (AskSheet, DESIGN.md "Question"): "Keep it"
 * is the main button and has the focus, Delete follows in seal.
 */
export function NoticeDelete(props: {
  slug: string;
  id: number;
  title: string;
  t: WorkspaceDictionary;
}) {
  const { t, slug } = props;
  /** The open question's request id (D100), new for each opening; null when closed. */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The library replaces this page's own entry, so Back never lands on the deleted notice's 404. The open
  // question owns one more entry (sheet-close.ts): closing it steps back off that entry first, and the
  // full load (a client-side push would be undone by that step) waits for it.
  const leave = (to: string) => {
    window.addEventListener("popstate", () => window.location.replace(to), { once: true });
    setAsking(null);
  };
  const remove = async (requestId: string) => {
    setBusy(true);
    setError(null);
    const answer = await sendDelete(slug, { id: props.id, requestId });
    // Someone else deleted it first: it is gone either way, with nothing of this officer's to undo.
    if (answer === "not_found") return leave(`/w/${slug}/notices`);
    if (answer === "ok") return leave(`/w/${slug}/notices?deleted=${props.id}&undo=${requestId}`);
    setBusy(false);
    setAsking(null);
    setError(answer === SIGNED_OUT ? SIGNED_OUT : t["notices.delete.failed"]);
  };
  return (
    <section className="mt-8 border-t border-rule pt-3">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setAsking(newRequestId())}
        className="min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
      >
        {t["notices.delete"]}
      </button>
      {error && (
        <RefusalLine
          text={error}
          className="mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
      {asking !== null && (
        <AskSheet
          id="notice-delete-ask"
          question={t["notices.delete.ask"]}
          yes={busy ? t["notices.delete.deleting"] : t["notices.delete.confirm"]}
          no={t["notices.delete.keep"]}
          seal
          busy={busy}
          onAnswer={(yes) => {
            if (yes) void remove(asking);
            else if (!busy) setAsking(null);
          }}
        >
          <p className="mt-3 font-subhead break-words">
            <bdi>{props.title}</bdi>
          </p>
          <p className="mt-2">{t["notices.delete.where"]}</p>
          <Notice tone="info" className="mt-3">
            {t["notices.delete.discord"]}
          </Notice>
        </AskSheet>
      )}
    </section>
  );
}

/** The library's line after a delete: "Notice deleted." with Undo, gone after UNDO_SHOWN_MS. */
export function DeletedLine(props: {
  slug: string;
  id: number;
  requestId: string;
  t: WorkspaceDictionary;
}) {
  const { t, slug } = props;
  const router = useRouter();
  const [state, setState] = useState<"shown" | "busy" | "failed" | "closed">("shown");
  useEffect(() => {
    const timer = setTimeout(() => setState((s) => (s === "shown" ? "closed" : s)), UNDO_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);
  const undo = async () => {
    setState("busy");
    const answer = await sendDelete(slug, { id: props.id, requestId: props.requestId, undo: true });
    if (answer !== "ok") return setState("failed");
    // The notice takes this entry's place, so Back never shows a stale "Notice deleted." with Undo. (A
    // replace to the plain library then a push is cancelled by the push.)
    router.replace(`/w/${slug}/notices/${props.id}`);
  };
  return (
    <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" className="text-body-sm font-semibold text-sage">
        {state === "failed" ? t["notices.delete.undoFailed"] : t["notices.deleted"]}
      </p>
      {(state === "shown" || state === "busy") && (
        <button
          type="button"
          disabled={state === "busy"}
          onClick={() => void undo()}
          className={chip()}
        >
          {t["notices.undo"]}
        </button>
      )}
    </div>
  );
}
