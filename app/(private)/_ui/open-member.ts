"use client";

// The open member of a master-detail list (D122: Members, Former members): in the address as `?m=<uid>`,
// so a shared link opens them and back works. From 1024 the member shows in the pane beside the list and
// each open or close is its own history entry. Below 1024 the bottom sheet takes its own entry, as before
// (sheet-close.ts), so the address is only replaced. `wide` is null until the browser has said its width.
//
// Below 1024 the address follows the open member, never the other way round, and only the sheet's own
// history entry carries `?m=`: it is written there once the sheet has pushed the entry, and a shared link
// takes it off the page's entry while the page hydrates, before the sheet opens. A sheet that closes by
// Close, the backdrop or Escape takes its entry off with history.back(), and the phone's back button
// steps off it; both land on the list's address. Before 2026-11-21 that entry kept `?m=`, and reading the
// member from it opened the card again with "Loading…" (or, after a refresh, loaded the page with the card
// open). The back button and a forward step are the sheet frame's (sheet-close.ts).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { sheetDepth } from "@/lib/brand/components/sheet-close";

const WIDE = "(min-width: 64rem)";

const subscribe = (change: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** At least 1024 px wide (Tailwind `lg`); null on the server and while hydrating. */
export function useWide(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

/** The uid in `m` (a new member's is negative, D106), or null. */
function uidOf(m: string | null): number | null {
  const uid = m === null || m === "" ? NaN : Number(m);
  return Number.isSafeInteger(uid) && uid !== 0 ? uid : null;
}

/**
 * The address with `m` set to this uid, or without it. A replace that changes nothing is skipped. Safari
 * refuses more than 100 history changes in 10 s (a SecurityError); the address then stays as it was, so
 * quick opens and closes never take the page down from the layout effect below.
 */
function write(uid: number | null, push: boolean) {
  const url = new URL(window.location.href);
  if (uid === null) url.searchParams.delete("m");
  else url.searchParams.set("m", String(uid));
  if (!push && url.href === window.location.href) return;
  try {
    window.history[push ? "pushState" : "replaceState"](window.history.state, "", url);
  } catch {
    // Refused by the browser's limit: keep the address.
  }
}

/** `initial` is `?m=` as the page was asked for. */
export function useOpenMember(initial: string | null) {
  const wide = useWide();
  const [open, setOpen] = useState(() => uidOf(initial));
  const now = useRef({ open, wide, widened: false });
  // After the sheet's own layout effect (a child's runs first), so `?m=` goes onto the sheet's entry.
  useLayoutEffect(() => {
    // Widened past 1024 with the sheet open: the sheet has just stepped off its entry, onto the list's
    // address, and the member stays open in the pane (D122), so that step writes them, not reads them.
    const onSheet = sheetDepth(window.history.state) > 0;
    const widened = now.current.wide === false && wide === true && onSheet;
    now.current = { open, wide, widened };
    // Closed while the sheet's entry is still the current one: its history.back() is on the way and
    // would drop what is written here (Safari allows 100 history changes in 10 s).
    if (wide === false && !(open === null && onSheet)) write(open, false);
    else if (wide === null && open !== null && !window.matchMedia(WIDE).matches) write(null, false);
  }, [open, wide]);
  useEffect(() => {
    const sync = () => {
      const { open, wide, widened } = now.current;
      now.current.widened = false;
      if (widened) write(open, false);
      else if (wide !== false) setOpen(uidOf(new URLSearchParams(window.location.search).get("m")));
      else if (open === null) write(null, false);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return {
    open,
    wide,
    /** Opens a member; `step` (the arrow keys) moves the open row without a history entry each time. */
    show(uid: number, step = false) {
      if (uid === open) return;
      if (wide === true) write(uid, !step);
      setOpen(uid);
    },
    close() {
      if (wide === true) write(null, true);
      setOpen(null);
    },
  };
}

export type OpenMember = ReturnType<typeof useOpenMember>;

/**
 * Up and Down on a list row move to the row before or after it (`data-row`), the one on screen: a table
 * and its phone cards both carry it. Returns the row's uid (`data-uid`) when the focus moved.
 */
export function stepRow(e: { key: string; target: EventTarget; preventDefault(): void }) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return null;
  const from = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
  if (!from) return null;
  const to = shown(`[data-row="${Number(from.dataset.row) + (e.key === "ArrowDown" ? 1 : -1)}"]`);
  if (!to) return null;
  e.preventDefault();
  to.focus();
  return to.dataset.uid ? Number(to.dataset.uid) : null;
}

/** The element matching this selector that is on screen: a table row and its card both match, and the
 * hidden one has no layout box. */
export function shown(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (el) => el.getClientRects().length > 0,
  );
}
