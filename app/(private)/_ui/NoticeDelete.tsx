"use client";

// Deleting a notice (issue 411, D118). "Delete notice" at the foot of a notice's page opens a sheet that
// names the notice, says where it leaves, and that what was posted to Discord stays there. Delete sends once
// (a request id per opened sheet, D100) and goes back to the library, which says "Notice deleted." with Undo
// for UNDO_SHOWN_MS; Undo names the same request id and brings the notice back.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** How long the library offers Undo; the server takes it back for a while longer (UNDO_MS). */
const UNDO_SHOWN_MS = 10_000;

/** "ok", or the refusal's code ("lost" when no answer came). */
async function send(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/notices/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    const { code } = (await res.json().catch(() => ({}))) as { code?: string };
    return code ?? "failed";
  } catch {
    return "lost";
  }
}

function DeleteSheet(props: {
  slug: string;
  id: number;
  title: string;
  t: WorkspaceDictionary;
  onClose: () => void;
}) {
  const { t, slug } = props;
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A full load, as the other sheets that leave the page do: the open sheet's own history entry would undo
  // a client-side push when it closes.
  const remove = async () => {
    setBusy(true);
    setError(null);
    const answer = await send(slug, { id: props.id, requestId });
    // Someone else deleted it first: it is gone either way, with nothing of this officer's to undo.
    if (answer === "not_found") return window.location.assign(`/w/${slug}/notices`);
    if (answer !== "ok") {
      setBusy(false);
      return setError(answer === SIGNED_OUT ? SIGNED_OUT : t["notices.delete.failed"]);
    }
    window.location.assign(`/w/${slug}/notices?deleted=${props.id}&undo=${requestId}`);
  };
  return (
    <Sheet
      labelledBy="delete-title"
      onCancel={props.onClose}
      title={t["notices.delete.ask"]}
      words={sheetWords(t)}
      primary={{
        label: busy ? t["notices.delete.deleting"] : t["notices.delete.confirm"],
        disabled: busy,
        onClick: () => void remove(),
      }}
      note={
        error && (
          <RefusalLine
            text={error}
            className="mb-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
          />
        )
      }
    >
      <p className="font-subhead text-display-sm break-words">
        <bdi>{props.title}</bdi>
      </p>
      <p className="mt-2">{t["notices.delete.where"]}</p>
      <Notice tone="info" className="mt-3">
        {t["notices.delete.discord"]}
      </Notice>
    </Sheet>
  );
}

/** "Delete notice" at the foot of a notice's page. */
export function NoticeDelete(props: {
  slug: string;
  id: number;
  title: string;
  t: WorkspaceDictionary;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8 border-t border-rule pt-3">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="min-h-11 px-1 font-semibold text-seal underline underline-offset-4"
      >
        {props.t["notices.delete"]}
      </button>
      {open && <DeleteSheet {...props} onClose={() => setOpen(false)} />}
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
    const answer = await send(slug, { id: props.id, requestId: props.requestId, undo: true });
    if (answer !== "ok") return setState("failed");
    router.push(`/w/${slug}/notices/${props.id}`);
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
