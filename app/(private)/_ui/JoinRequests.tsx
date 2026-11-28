"use client";

// Members → Requests (issue 868): each open `/join` request with one "Approve as …" per player of the newest
// roster its typed name or ID matches, and Decline. A request with no match says it is not in the roster yet,
// and only Decline is there. After an answer the line says what happened (role given, welcome posted) and the
// page reads again. Every line is written on the server; the browser only sends the officer's tap.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface RequestRow {
  id: number;
  /** "mossy asks to join as “Moss”". */
  asked: string;
  /** "Sent Thu, Nov 26". */
  when: string;
  candidates: { uid: number; label: string }[];
  /** "Not in the roster yet…", when no player matches. */
  none: string | null;
}

export type JoinWords = Record<
  | "decline"
  | "approved"
  | "declined"
  | "given"
  | "giveFailed"
  | "noRole"
  | "welcomed"
  | "welcomeFailed"
  | "gone"
  | "taken"
  | "failed",
  string
>;

type Answer = { role?: "given" | "failed" | "none"; welcome?: "posted" | "failed" | "off" };

/** What the officer reads after the answer went through. */
function doneText(a: Answer, words: JoinWords): string {
  if (!a.role) return words.declined;
  const role = { given: words.given, failed: words.giveFailed, none: words.noRole }[a.role];
  const welcome = { posted: words.welcomed, failed: words.welcomeFailed, off: null }[
    a.welcome ?? "off"
  ];
  return [words.approved, role, welcome].filter(Boolean).join(" ");
}

function Request({ slug, row, words }: { slug: string; row: RequestRow; words: JoinWords }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function answer(body: object) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/w/${slug}/join-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, id: row.id }),
      });
      const json = ((await res.json().catch(() => ({}))) ?? {}) as Answer & { code?: string };
      if (res.ok) {
        setNote({ ok: true, text: doneText(json, words) });
        router.refresh();
      } else {
        const code = json.code ?? "failed";
        const text =
          code === SIGNED_OUT ? SIGNED_OUT : (words[code as keyof JoinWords] ?? words.failed);
        setNote({ ok: false, text });
      }
    } catch {
      setNote({ ok: false, text: words.failed });
    }
    setBusy(false);
  }

  return (
    <li className="drawn-card px-4 py-3">
      <p className="font-semibold break-words">{row.asked}</p>
      <p className="text-body-sm text-ink/75">{row.when}</p>
      {row.none && <p className="mt-2">{row.none}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {row.candidates.map((c) => (
          <button
            key={c.uid}
            type="button"
            disabled={busy}
            onClick={() => answer({ action: "approve", uid: c.uid })}
            className={buttonClass("primary", "break-words")}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => answer({ action: "decline" })}
          className={buttonClass("secondary")}
        >
          {words.decline}
        </button>
      </div>
      {note &&
        (note.ok ? (
          <p role="status" className="mt-2 font-semibold">
            {note.text}
          </p>
        ) : (
          <RefusalLine text={note.text} className="mt-2 font-semibold text-seal" />
        ))}
    </li>
  );
}

export function JoinRequests(props: { slug: string; rows: RequestRow[]; words: JoinWords }) {
  return (
    <ul className="mt-4 space-y-3">
      {props.rows.map((row) => (
        <Request key={row.id} slug={props.slug} row={row} words={props.words} />
      ))}
    </ul>
  );
}
