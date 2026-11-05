"use client";

// A confirmation in the bottom sheet (docs/DESIGN.md: bottom-sheet = PIN entry and confirmations).
import { buttonClass } from "@/lib/brand/components/Button";

export function ConfirmSheet({
  text,
  onAnswer,
}: {
  text: string;
  onAnswer: (yes: boolean) => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Confirm"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper p-4 shadow-[0_-8px_24px_var(--sheet-shadow)]"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p>{text}</p>
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className={buttonClass("primary", "font-semibold")}
        >
          Go ahead
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className={buttonClass("secondary", "font-semibold")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
