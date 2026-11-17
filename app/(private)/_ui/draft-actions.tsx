"use client";

// What both draft reviews share (issue 299): posting a decision at the version the officer opened, with
// the refusal in words (who saved first, a stale member fact); the Save and Discard buttons with, above
// them, why Save is off ("Row #2 needs a member…", the row a link to its card); asking before a change of
// type throws the officer's fixes away.
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
        const name = (data.by as string | null) ?? w["shots.someone"] ?? "";
        setMessage(fillIn(template, { name }));
      }
      return { ok: res.ok, data };
    } catch {
      setMessage(w["shots.e.failed"] ?? "");
      return { ok: false, data: {} };
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, act };
}

/** Why Save is off: a sentence, with `{row}` shown as a link to that row's card. */
export interface Why {
  template: string | undefined;
  row?: { label: string; href: string };
}

function WhyLine({ why }: { why: Why }) {
  const [before, after = ""] = (why.template ?? "").split("{row}");
  return (
    <p className="mb-2 border-l-4 border-yarn pl-2 text-body-sm">
      {before}
      {why.row && (
        <a
          href={why.row.href}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {why.row.label}
        </a>
      )}
      {after}
    </p>
  );
}

export function Actions(props: {
  w: Words;
  busy: boolean;
  /** null: Save is on. */
  why: Why | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { w, busy } = props;
  return (
    <div className="mt-4">
      {props.why && <WhyLine why={props.why} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || props.why !== null}
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
    </div>
  );
}

/** The message under a review: why a save was refused. */
export function Message({ text }: { text: string | null }) {
  return (
    <div aria-live="polite" className="mt-3">
      {text && <p className="border-l-4 border-seal pl-3">{text}</p>}
    </div>
  );
}

/** Asks before a change of type re-reads the pictures and drops the officer's fixes. */
export const confirmRetype = (changed: boolean, w: Words) =>
  !changed || window.confirm(w["shots.retypeConfirm"] ?? "");
