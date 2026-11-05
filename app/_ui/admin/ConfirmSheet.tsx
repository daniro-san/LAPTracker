"use client";

// A confirmation in the bottom sheet (docs/DESIGN.md: bottom-sheet = PIN entry and confirmations).
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-300 bg-white p-4 shadow-[0_-8px_24px_var(--sheet-shadow)] dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p>{text}</p>
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className="min-h-11 rounded-xs bg-zinc-900 px-4 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Go ahead
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="min-h-11 rounded-xs border border-zinc-400 px-4 font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
