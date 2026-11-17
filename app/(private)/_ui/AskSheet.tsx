"use client";

// A question before something is thrown away or deleted (DESIGN.md "Workspace components"): an alertdialog
// named by its question; the safe answer is first, the main button, and has the focus; the destructive one
// follows it. Escape and back answer no.
import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";

export function AskSheet(props: {
  id: string;
  question: string;
  /** The destructive answer: "Discard". */
  yes: string;
  /** The safe answer: "Keep editing". */
  no: string;
  onAnswer: (yes: boolean) => void;
}) {
  return (
    <Sheet role="alertdialog" labelledBy={props.id} onCancel={() => props.onAnswer(false)}>
      <p id={props.id} className="font-subhead text-display-sm">
        {props.question}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          data-initial-focus
          onClick={() => props.onAnswer(false)}
          className={buttonClass("primary", "flex-1")}
        >
          {props.no}
        </button>
        <button
          type="button"
          onClick={() => props.onAnswer(true)}
          className={buttonClass("secondary")}
        >
          {props.yes}
        </button>
      </div>
    </Sheet>
  );
}
