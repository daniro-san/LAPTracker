"use client";

// What both draft reviews share (issue 299): posting a decision at the version the officer opened, with
// the refusal in words (who saved first, a stale member fact); the Save and Discard buttons with, above
// them, why Save is off ("Row #2 needs a member…", the row a link to its card); asking before Discard
// deletes the draft and before a change of type throws the officer's fixes away.
import { useState } from "react";

import { track, type ScreenshotKind } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { isolate } from "@/lib/copy";

import { AskSheet } from "./AskSheet";
import { fillIn, type Words } from "./draft-known";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";

export type Answer = { ok: boolean; data: Record<string, unknown> };

/** Posts a decision on the draft at the version the officer opened; says why when it is refused. */
export function useDraftActions(
  slug: string,
  view: { id: number; version: number; kind: ScreenshotKind },
  w: Words,
) {
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
      if (res.ok && "action" in body && body.action === "discard") {
        track("ws_draft_discarded", { kind: view.kind });
      }
      if (res.status === 401) setMessage(SIGNED_OUT);
      else if (!res.ok) {
        const template = w[`shots.e.${String(data.code)}`] ?? w["shots.e.failed"];
        const name = (data.by as string | null) ?? w["shots.someone"] ?? "";
        setMessage(fillIn(template, { name: isolate(name) }));
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
  const [asking, setAsking] = useState(false);
  return (
    <div className="mt-4">
      {props.why && <WhyLine why={props.why} />}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || props.why !== null}
          onClick={props.onSave}
          className={buttonClass("primary", "flex-1 sm:flex-none sm:px-6")}
        >
          {busy ? w["shots.saving"] : w["shots.save"]}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAsking(true)}
          className={buttonClass("secondary")}
        >
          {w["shots.discard"]}
        </button>
      </div>
      {asking && (
        <AskSheet
          id="draft-discard"
          question={w["shots.discardAsk"] ?? ""}
          yes={w["shots.discard"] ?? ""}
          no={w["sheet.keep"] ?? ""}
          onAnswer={(yes) => {
            setAsking(false);
            if (yes) props.onDiscard();
          }}
        />
      )}
    </div>
  );
}

/** The message under a review: why a save was refused. */
export function Message({ text }: { text: string | null }) {
  return (
    <div aria-live="polite" className="mt-3">
      {text === SIGNED_OUT ? (
        <SignedOutNote className="border-l-4 border-seal pl-3" />
      ) : (
        text && <p className="border-l-4 border-seal pl-3">{text}</p>
      )}
    </div>
  );
}

/** Asks before a change of type re-reads the pictures and drops the officer's fixes. */
export const confirmRetype = (changed: boolean, w: Words) =>
  !changed || window.confirm(w["shots.retypeConfirm"] ?? "");
