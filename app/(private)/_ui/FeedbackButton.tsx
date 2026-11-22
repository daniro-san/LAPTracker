"use client";

// "Send feedback" (D157, issue 713): a button at the end of every desk page and of the board, and the sheet it
// opens: the kind (Idea, Problem, Something good), the message (up to 1,000 characters) and Send. After a
// send the sheet says "Received, thank you." and nothing else comes back. The hidden `website` field is the
// honeypot: people never see or reach it. PostHog gets the area and the kind only, never the text.
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Sheet, type SheetWords } from "@/lib/brand/components/Sheet";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import type { FeedbackWords } from "@/lib/private/dictionary.feedback";
import { fill } from "@/lib/words";

import { Choice } from "./CalendarFields";

const MAX = 1000;
const KINDS = ["idea", "problem", "good"] as const;
type Kind = (typeof KINDS)[number];

interface Props {
  slug: string;
  area: "desk" | "board";
  language: WorkspaceLanguage;
  words: FeedbackWords;
  sheet: SheetWords;
}

type Entry = "badge" | "end";

function FeedbackSheet(props: Props & { entry: Entry; onClose: () => void }) {
  const w = props.words;
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "received">("idle");
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!kind || text.trim() === "") return;
    setState("busy");
    setError(null);
    const res = await fetch(`/api/w/${props.slug}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        area: props.area,
        kind,
        text,
        path: window.location.pathname,
        language: props.language,
        website,
      }),
    }).catch(() => null);
    // Read to its end, so the browser finishes the answer.
    await res?.json().catch(() => null);
    if (res?.ok) {
      track("feedback_sent", { feedback_area: props.area, kind, entry: props.entry });
      return setState("received");
    }
    setState("idle");
    setError(res?.status === 429 ? w["feedback.tooMany"] : w["feedback.failed"]);
  };
  const received = state === "received";
  return (
    <Sheet
      labelledBy="feedback-title"
      onCancel={props.onClose}
      title={w["feedback.open"]}
      words={props.sheet}
      dirty={!received && (kind !== null || text !== "")}
      // After a send, no bar: only Close, so nothing reads as "undo".
      {...(!received && {
        primary: {
          label: state === "busy" ? w["feedback.sending"] : w["feedback.send"],
          onClick: () => void send(),
          disabled: state === "busy" || kind === null || text.trim() === "",
        },
      })}
      note={
        error && (
          <p role="alert" className="mb-2 font-semibold text-seal">
            {error}
          </p>
        )
      }
    >
      {received ? (
        <Received text={w["feedback.received"]} close={props.sheet.close} onClose={props.onClose} />
      ) : (
        <Fields
          words={w}
          language={props.language}
          kind={kind}
          text={text}
          website={website}
          onKind={setKind}
          onText={setText}
          onWebsite={setWebsite}
        />
      )}
    </Sheet>
  );
}

/** After a send: "Received, thank you." and Close only, so nothing reads as "undo". */
function Received(props: { text: string; close: string; onClose: () => void }) {
  return (
    <>
      <p role="status" className="font-semibold">
        {props.text}
      </p>
      <button
        type="button"
        data-initial-focus
        onClick={props.onClose}
        className={buttonClass("primary", "mt-4 w-full")}
      >
        {props.close}
      </button>
    </>
  );
}

/** The kind, the message with its count, and the hidden honeypot. Masked in session replay. */
function Fields(props: {
  words: FeedbackWords;
  language: WorkspaceLanguage;
  kind: Kind | null;
  text: string;
  website: string;
  onKind: (k: Kind) => void;
  onText: (s: string) => void;
  onWebsite: (s: string) => void;
}) {
  const w = props.words;
  const number = (n: number) => new Intl.NumberFormat(props.language).format(n);
  return (
    <div className="ph-no-capture">
      <p>{w["feedback.lead"]}</p>
      <Choice
        legend={w["feedback.kind"]}
        name="feedback-kind"
        value={props.kind}
        options={KINDS.map((k) => ({ value: k, label: w[`feedback.kind.${k}`] }))}
        onChange={props.onKind}
      />
      {props.kind === null && props.text.trim() !== "" && (
        <p className="mt-1 text-body-sm font-semibold">{w["feedback.pickKind"]}</p>
      )}
      <div className="mt-4">
        <label htmlFor="feedback-text" className="block text-body-sm font-semibold">
          {w["feedback.text"]}
        </label>
        <textarea
          id="feedback-text"
          value={props.text}
          maxLength={MAX}
          rows={6}
          aria-describedby="feedback-text-note"
          onChange={(e) => props.onText(e.target.value)}
          className={`${FIELD} mt-1`}
        />
        <p id="feedback-text-note" className="mt-1 text-body-sm text-ink/75">
          {w["feedback.limit"]}
        </p>
        <p className="mt-1 text-right text-body-sm text-ink/75 tabular-nums">
          {fill(w["feedback.count"], { n: number(props.text.length), max: number(MAX) })}
        </p>
      </div>
      {/* The honeypot: off screen, out of the tab order and hidden from screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="feedback-website">{w["feedback.website"]}</label>
        <input
          id="feedback-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={props.website}
          onChange={(e) => props.onWebsite(e.target.value)}
        />
      </div>
    </div>
  );
}

// From 1280 (the width the desk's sidebar shows) a small "Feedback" badge also floats at the bottom left, so
// the entry is in view without scrolling to the end. It sits in the sidebar's column on the desk (the sidebar
// keeps room for it) and in the empty margin on the board and Me, so it never covers content. Below 1280
// there is no floating element: the bottom tabs own that corner on a phone. It opens the same sheet.
export function FeedbackButton(props: Props) {
  const [entry, setEntry] = useState<Entry | null>(null);
  return (
    <div className="mt-10 border-t border-rule pt-4">
      <button type="button" onClick={() => setEntry("end")} className={buttonClass("secondary")}>
        {props.words["feedback.open"]}
      </button>
      {entry === null && (
        <button
          type="button"
          onClick={() => setEntry("badge")}
          className={buttonClass("secondary", "fixed bottom-4 left-4 z-10 bg-paper max-xl:hidden")}
        >
          {props.words["feedback.badge"]}
        </button>
      )}
      {entry !== null && <FeedbackSheet {...props} entry={entry} onClose={() => setEntry(null)} />}
    </div>
  );
}
