"use client";

// The bottom sheet as a real <dialog> (07c S6). Modal: showModal() gives the focus trap, aria-modal and
// Escape (the `cancel` event); on close, focus goes back to what opened it. The gate's sheet is the page
// itself, so it stays open and non-modal. Below 640 px a sheet pinned to the bottom; at ≥ 640 px the
// gate's sheet is a card under the heading (07c S3c) and a modal one sits centred.
import { useLayoutEffect, useRef } from "react";

export const SHEET =
  "fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-rule bg-paper p-4 text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] backdrop:bg-ink/20";

/** A centred card at ≥ 640 px: the confirm sheet and the PIN asked for by an action. */
export const MODAL_CARD = "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:border sm:p-6";

/** The gate's sheet at ≥ 640 px: part of the page flow, under the heading. */
export const GATE_CARD = "sm:static sm:mt-6 sm:border sm:p-6 sm:shadow-none";

export function useSheet(modal: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // showModal() focuses the first control; a sheet can name a safer one (Cancel) to start on.
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [modal]);
  return ref;
}
