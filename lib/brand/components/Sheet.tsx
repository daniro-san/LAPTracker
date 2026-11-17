"use client";

// The bottom sheet (DESIGN.md `bottom-sheet`) as a real <dialog>: the one place a confirmation or a PIN
// is asked. Modal (default): showModal() gives the focus trap, aria-modal and Escape (`onCancel`); on
// close, focus goes back to what opened it, and a child marked `data-initial-focus` gets the first
// focus (put it on the safe answer). `gate` is the same card left open in the page flow, under a
// heading, for a page that is locked until it is answered. Below 640 px a sheet pinned to the bottom;
// at ≥ 640 px a centred card (modal) or a card in the flow (gate).
import { useLayoutEffect, useRef, type ReactNode } from "react";

// iPhone (Safari, Brave): the sheet is its own only scroller, never wider than the screen, below the
// notch, and a scroll that reaches its end stays in it. Long names, links and zone ids wrap. The page
// behind is locked while a modal sheet is open (app/globals.css).
const FIT =
  "max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] overflow-x-hidden overflow-y-auto overscroll-contain wrap-anywhere";
const SHEET = `fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-rule bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] backdrop:bg-[var(--sheet-scrim)] ${FIT}`;
const MODAL_CARD =
  "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-3rem)] sm:max-w-md sm:border sm:p-6";
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
      // Without preventScroll the page jumps back to the opener (to the top for a header button).
      opener?.focus({ preventScroll: true });
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
  backdropCloses = false,
  children,
}: {
  gate?: boolean;
  role?: "alertdialog";
  /** The id of the element that names the sheet. */
  labelledBy: string;
  describedBy?: string;
  /** Escape. Without it the browser's own close is blocked: a sheet answers through its buttons. */
  onCancel?: () => void;
  /** A tap on the backdrop, outside the card, also calls `onCancel` (a sheet of details, not a question). */
  backdropCloses?: boolean;
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
      onClick={(e) => {
        if (!backdropCloses || e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        const inside =
          e.clientX >= box.left &&
          e.clientX <= box.right &&
          e.clientY >= box.top &&
          e.clientY <= box.bottom;
        if (!inside) onCancel?.();
      }}
      className={`${SHEET} ${gate ? GATE_CARD : MODAL_CARD}`}
    >
      {children}
    </dialog>
  );
}
