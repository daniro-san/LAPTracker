"use client";

// A confirmation in the bottom sheet (docs/DESIGN.md: bottom-sheet = PIN entry and confirmations): a
// modal alertdialog named by its question; focus starts on Cancel, Escape answers no (07c S6).
import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";

import { MODAL_CARD, SHEET, useSheet } from "./sheet";

export function ConfirmSheet({
  text,
  onAnswer,
}: {
  text: string;
  onAnswer: (yes: boolean) => void;
}) {
  const ref = useSheet(true);
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="confirm-text"
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      className={`${SHEET} ${MODAL_CARD}`}
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p id="confirm-text">{text}</p>
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className={buttonClass("primary", "font-semibold")}
        >
          {copy.admin.confirm.yes}
        </button>
        <button
          type="button"
          data-initial-focus
          onClick={() => onAnswer(false)}
          className={buttonClass("secondary", "font-semibold")}
        >
          {copy.admin.confirm.no}
        </button>
      </div>
    </dialog>
  );
}
