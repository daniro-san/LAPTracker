"use client";

// What both draft reviews share (issue 299): posting a decision at the version the officer opened, with
// the refusal in words (who saved first, a stale member fact), and the Save and Discard buttons.
import { useState } from "react";

import { fillIn, type Words } from "./draft-known";

export type Answer = { ok: boolean; data: Record<string, unknown> };

/** Posts a decision on the draft at the version the officer opened; says why when it is refused. */
export function useDraftActions(slug: string, view: { id: number; version: number }, w: Words) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function act(body: object): Promise<Answer> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/w/${slug}/shots/${view.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: view.version, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const template = w[`shots.e.${String(data.code)}`] ?? w["shots.e.failed"];
        setMessage(
          fillIn(template, { name: (data.by as string | null) ?? w["shots.someone"] ?? "" }),
        );
      }
      return { ok: res.ok, data };
    } catch {
      setMessage(w["shots.e.failed"] ?? "");
      return { ok: false, data: {} };
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, setMessage, act };
}

export function Actions(props: {
  w: Words;
  busy: boolean;
  ready: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { w, busy } = props;
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy || !props.ready}
        onClick={props.onSave}
        className="ink-button inline-flex min-h-11 items-center justify-center px-6 font-medium disabled:opacity-50"
      >
        {busy ? w["shots.saving"] : w["shots.save"]}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={props.onDiscard}
        className="inline-flex min-h-11 items-center px-4 font-medium underline underline-offset-4"
      >
        {w["shots.discard"]}
      </button>
    </div>
  );
}

/** The message under a review: why a save was refused, or what it saved. */
export function Message({ text }: { text: string | null }) {
  return (
    <div aria-live="polite" className="mt-3">
      {text && <p className="border-l-4 border-seal pl-3">{text}</p>}
    </div>
  );
}
