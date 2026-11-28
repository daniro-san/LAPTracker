"use client";

// A KvK plan role's asks (issue 831, D161 amended): the members who said "I'm in" from their own page,
// "Aster Vale (asked)", each with Confirm and Decline. Off while the plan has unsaved changes, with the
// reason under the list, so an answer never drops an officer's edits. Never in replay (ph-no-capture).
import { buttonClass } from "@/lib/brand/components/Button";
import type { KvkPlanWords } from "@/lib/private/dictionary.kvk-plan";
import { fill } from "@/lib/words";

export type Ask = { role: string; uid: number; name: string };
export type Reply = "confirm" | "decline";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export function Asks(props: {
  role: string;
  asks: Ask[];
  words: KvkPlanWords;
  /** Unsaved changes: the buttons are off and the line says why. */
  dirty: boolean;
  /** Null while the plan has unsaved changes or a request runs. */
  onAnswer: ((role: string, uid: number, reply: Reply) => void) | null;
}) {
  const { words, role, onAnswer } = props;
  if (props.asks.length === 0) return null;
  return (
    <>
      <ul className="ph-no-capture mt-2">
        {props.asks.map((a) => (
          <li key={a.uid} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
            <span translate="no" className="font-semibold">
              {fill(words["kvkPlan.asked"], { name: a.name })}
            </span>
            <button
              type="button"
              disabled={!onAnswer}
              aria-label={fill(words["kvkPlan.confirmOf"], { name: a.name, role })}
              onClick={() => onAnswer?.(role, a.uid, "confirm")}
              className={buttonClass("secondary")}
            >
              {words["kvkPlan.confirm"]}
            </button>
            <button
              type="button"
              disabled={!onAnswer}
              aria-label={fill(words["kvkPlan.declineOf"], { name: a.name, role })}
              onClick={() => onAnswer?.(role, a.uid, "decline")}
              className={LINK}
            >
              {words["kvkPlan.decline"]}
            </button>
          </li>
        ))}
      </ul>
      {props.dirty && (
        <p className="mt-1 text-body-sm font-semibold">{words["kvkPlan.answerSaveFirst"]}</p>
      )}
    </>
  );
}
