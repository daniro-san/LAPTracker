"use client";

// The 14 days before a workspace is deleted (D125): on every desk and board page, the date and, for an
// officer, "Cancel the deletion" (any officer may). A member's board says only when it closes. One request
// id per banner (D100), so a retry after a lost answer cancels once.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface BannerWords {
  /** "This workspace will be deleted after 3 December 2026." */
  line: string;
  more: string;
  cancel: string;
  cancelled: string;
  failed: string;
}

export function DeletionBanner({
  slug,
  words,
  officer,
}: {
  slug: string;
  words: BannerWords;
  /** An officer's session: the cancel button. */
  officer: boolean;
}) {
  const router = useRouter();
  const [requestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const cancel = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/w/${slug}/workspace-deletion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", requestId }),
      });
      if (res.ok) {
        setNote({ ok: true, text: words.cancelled });
        router.refresh();
      } else {
        setNote({ ok: false, text: res.status === 401 ? SIGNED_OUT : words.failed });
      }
    } catch {
      setNote({ ok: false, text: words.failed });
    }
    setBusy(false);
  };
  return (
    <section
      aria-label={words.line}
      className="mb-4 border-l-4 border-seal bg-paper py-2 pl-3 text-body-sm"
    >
      <p className="font-semibold text-seal">{words.line}</p>
      {words.more && <p className="mt-1">{words.more}</p>}
      {officer && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void cancel()}
          className={buttonClass("secondary", "mt-2")}
        >
          {words.cancel}
        </button>
      )}
      {note &&
        (note.ok ? (
          <p role="status" className="mt-2 font-semibold">
            {note.text}
          </p>
        ) : (
          <RefusalLine text={note.text} className="mt-2 font-semibold text-seal" />
        ))}
    </section>
  );
}
