"use client";

// What the member sent about themselves (D154), on their card's header, while an officer has not seen it:
// a block of its own (tinted, its heading "Sent by the member"), one line per field with both values
// labelled ("Member says: …", "On the card: …"), when it was sent and "New". "Put on the card" writes it as
// the card's fact (source "from the member"); "Mark seen" keeps the card as it is and says so. Each answer
// names the report as the card showed it, so it never reaches a later send. Never in replay (ph-no-capture).
import { useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import type { CardSelfReport, CardReportLine } from "@/lib/private/self-report";
import { fill } from "@/lib/words";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Done = "used" | "marked";

async function send(
  slug: string,
  uid: number,
  line: CardReportLine,
  action: "use" | "seen",
): Promise<"ok" | "changed" | "conflict" | typeof SIGNED_OUT | "failed"> {
  const body = {
    action,
    user: line.userId,
    field: line.field,
    version: line.version,
    ...(action === "use" && { factVersion: line.factVersion }),
  };
  const res = await fetch(`/api/w/${slug}/members/${uid}/self-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  await res?.json().catch(() => null);
  if (res?.ok) return "ok";
  if (res?.status === 401) return SIGNED_OUT;
  if (res?.status === 404) return "changed";
  return res?.status === 409 && action === "use" ? "conflict" : "failed";
}

type Words = CardSelfReport["words"];
type Answer = (line: CardReportLine, action: "use" | "seen") => void;

/** One unseen field: what the member says, when, what the card holds, and the two answers. */
function Line({
  l,
  w,
  busy,
  answer,
}: {
  l: CardReportLine;
  w: Words;
  busy: boolean;
  answer: Answer;
}) {
  return (
    <li className="border-t border-rule py-2 first:border-t-0">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{l.label}</span>
        <Tag tone="progress">{w["self.card.new"]}</Tag>
      </p>
      <p>{l.says}</p>
      <p className="text-ink/75">{l.sent}</p>
      <p className="text-ink/75">{l.same ? w["self.card.same"] : l.onCard}</p>
      <p className="mt-1 flex flex-wrap gap-2">
        {!l.same && !l.removed && (
          <button type="button" disabled={busy} onClick={() => answer(l, "use")} className={chip()}>
            {w["self.card.use"]}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => answer(l, "seen")} className={chip()}>
          {w["self.card.seen"]}
        </button>
      </p>
    </li>
  );
}

/** Under a fact on the Info tab: what the member said, seen, and not what the card holds. */
export function SelfReportInfo({ text }: { text: string | undefined }) {
  if (!text) return null;
  return <span className="ph-no-capture block text-[12px] text-plum">{text}</span>;
}

/** One answer at a time; a refusal says why, and a report that changed reads the card again. */
function useAnswer(
  props: { slug: string; uid: number; onChanged?: (() => void) | undefined; failed: string },
  w: Words | undefined,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The card is read again after an answer: the answered lines keep their outcome here.
  const [done, setDone] = useState<{ field: string; label: string; outcome: Done }[]>([]);
  const answer = async (line: CardReportLine, action: "use" | "seen") => {
    setBusy(true);
    const r = await send(props.slug, props.uid, line, action);
    setBusy(false);
    if (r === "ok") {
      setError("");
      const outcome = action === "use" ? "used" : "marked";
      setDone((d) => [...d, { field: line.field, label: line.label, outcome }]);
      if (action === "use") props.onChanged?.();
      return;
    }
    if (r === SIGNED_OUT || r === "failed" || !w)
      return setError(r === SIGNED_OUT ? r : props.failed);
    setError(
      r === "changed"
        ? w["self.card.changed"]
        : fill(w["self.card.conflict"], { field: line.label }),
    );
    props.onChanged?.();
  };
  return { busy, error, done, answer };
}

export function SelfReportCard(props: {
  slug: string;
  uid: number;
  report: CardSelfReport | null | undefined;
  /** Reads the card again: after "Put on the card" (the Info tab shows the new fact) or a changed report. */
  onChanged?: (() => void) | undefined;
  failed: string;
}) {
  // The words stay when a card read again has nothing left to show, for the answers' outcome lines.
  const [kept] = useState(props.report?.words);
  const w = props.report?.words ?? kept;
  const { busy, error, done, answer } = useAnswer(props, w);
  const lines = (props.report?.unseen ?? []).filter((l) => !done.some((d) => d.field === l.field));
  if (!w || (lines.length === 0 && done.length === 0)) return null;
  return (
    <section
      aria-labelledby={`self-report-${props.uid}`}
      className="ph-no-capture mt-2 border-l-4 border-plum bg-plum/5 px-3 py-2 text-body-sm"
    >
      <h3 id={`self-report-${props.uid}`} className="font-semibold">
        {w["self.card.head"]}
      </h3>
      <ul>
        {lines.map((l) => (
          <Line key={l.field} l={l} w={w} busy={busy} answer={(line, a) => void answer(line, a)} />
        ))}
      </ul>
      {lines.some((l) => !l.same && !l.removed) && (
        <p className="text-ink/75">{w["self.card.seenHint"]}</p>
      )}
      {done.map((d) => (
        <p key={d.field} role="status" className="border-t border-rule py-2">
          <span className="font-semibold">{d.label}</span>
          {" · "}
          {w[d.outcome === "used" ? "self.card.used" : "self.card.marked"]}
        </p>
      ))}
      {error && <RefusalLine text={error} className="font-semibold text-seal" />}
    </section>
  );
}
