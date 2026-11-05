"use client";

// The bottom sheet (DESIGN.md `bottom-sheet`) as a real <dialog>: the one place a confirmation or a PIN
// is asked. Modal (default): showModal() gives the focus trap, aria-modal and Escape (`onCancel`); on
// close, focus goes back to what opened it, and a child marked `data-initial-focus` gets the first
// focus (put it on the safe answer). `gate` is the same card left open in the page flow, under a
// heading, for a page that is locked until it is answered. Below 640 px a sheet pinned to the bottom;
// at ≥ 640 px a centred card (modal) or a card in the flow (gate).
import { useLayoutEffect, useRef, type ReactNode } from "react";

const SHEET =
  "fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-rule bg-paper p-4 text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] backdrop:bg-ink/20";
const MODAL_CARD = "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:border sm:p-6";
const GATE_CARD = "sm:static sm:mt-6 sm:border sm:p-6 sm:shadow-none";

function useSheet(modal: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [modal]);
  return ref;
}

export function Sheet({
  gate = false,
  role,
  labelledBy,
  describedBy,
  onCancel,
  children,
}: {
  gate?: boolean;
  role?: "alertdialog";
  /** The id of the element that names the sheet. */
  labelledBy: string;
  describedBy?: string;
  /** Escape. Without it the browser's own close is blocked: a sheet answers through its buttons. */
  onCancel?: () => void;
  children: ReactNode;
}) {
  const ref = useSheet(!gate);
  return (
    <dialog
      ref={ref}
      role={role}
      open={gate || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
      className={`${SHEET} ${gate ? GATE_CARD : MODAL_CARD}`}
    >
      {children}
    </dialog>
  );
}
