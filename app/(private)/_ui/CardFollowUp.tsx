"use client";

// The member card's Follow-up block (issue 516, amends D136), on the Overview after the reasons: what was
// noted this week (the note on its own line), "Talked to them" in one tap with Undo, and "Message to send"
// opening Follow-up's ready message (D140) with its two copies. Every save goes through Follow-up's route
// with a request id per tap (D100), marked as the card's for analytics; after a save or an undo the card is
// read again (`onChanged`), so the week line shows what is stored. Nothing is sent for the officer.
import { useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import type { CardFollowUp as Data } from "@/lib/private/card-follow-up";

import { Message } from "./FollowUpPanelParts";
import { send } from "./FollowUpSheet";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** The last tap: its record's request id, what came of it, and whether the member was on the list. */
type Done = {
  requestId: string;
  state: "saved" | "undone" | "changed" | "failed" | "signed_out";
  onList: boolean;
};

const answerOf = (status: number | undefined, ok: Done["state"]): Done["state"] =>
  status === 200 ? ok : status === 401 ? "signed_out" : status === 409 ? "changed" : "failed";

function DoneLine(props: {
  done: Done | null;
  w: Data["words"];
  busy: boolean;
  onUndo: () => void;
}) {
  const { done, w } = props;
  if (!done) return null;
  if (done.state === "failed" || done.state === "signed_out") {
    const text = done.state === "failed" ? w["followup.failed"] : SIGNED_OUT;
    return <RefusalLine text={text} className="mt-2 text-body-sm text-seal" />;
  }
  const text = {
    saved: w[done.onList ? "card.followup.savedList" : "card.followup.saved"],
    undone: w["card.followup.undone"],
    changed: w["card.followup.undoChanged"],
  }[done.state];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" className="text-body-sm font-semibold text-sage">
        {text}
      </p>
      {done.state === "saved" && (
        <button type="button" disabled={props.busy} onClick={props.onUndo} className={chip()}>
          {w["followup.undo"]}
        </button>
      )}
    </div>
  );
}

export function CardFollowUp(props: {
  slug: string;
  uid: number;
  data: Data;
  /** Read the card again: the week line then shows what was stored. */
  onChanged?: (() => void) | undefined;
}) {
  const { data, slug, uid } = props;
  const w = data.words;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const talked = async () => {
    const requestId = newRequestId();
    const onList = data.onList;
    setBusy(true);
    const body = { uid, action: "talked", note: "", until: null, version: 0, requestId };
    const r = await send(slug, { ...body, from: "card", onList });
    setBusy(false);
    setDone({ requestId, onList, state: answerOf(r?.status, "saved") });
    if (r?.status === 200) props.onChanged?.();
  };
  const undo = async () => {
    if (!done) return;
    setBusy(true);
    const body = { uid, action: "undo", target: done.requestId, requestId: newRequestId() };
    const r = await send(slug, { ...body, from: "card", onList: done.onList });
    setBusy(false);
    setDone({ ...done, state: answerOf(r?.status, "undone") });
    // A 409: the notes changed since; the card shows what is stored now.
    if (r?.status === 200 || r?.status === 409) props.onChanged?.();
  };
  const panel = `card-message-${uid}`;
  return (
    <section className="mt-3 border-t border-rule pt-3">
      {data.week && (
        // ph-no-capture (issue 549): the note and who wrote it never reach session replay.
        <div className="ph-no-capture text-body-sm">
          <p className="font-semibold">{data.week}</p>
          {data.note && <p className="whitespace-pre-line">{data.note}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          // Off while saving, and while "Saved." shows: a second tap would write a second record.
          disabled={busy || done?.state === "saved"}
          onClick={() => void talked()}
          className={chip()}
        >
          {w["followup.talkedNow"]}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((o) => !o)}
          className={chip(open)}
        >
          {w["card.followup.open"]}
          <span aria-hidden="true">{open ? " ▴" : " ▾"}</span>
        </button>
      </div>
      <DoneLine done={done} w={w} busy={busy} onUndo={() => void undo()} />
      <div id={panel} hidden={!open}>
        {open && <Message message={data.message} words={w} where="card" />}
      </div>
    </section>
  );
}
