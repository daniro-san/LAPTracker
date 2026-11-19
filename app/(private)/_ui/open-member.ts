"use client";

// The open member of a master-detail list (D122: Members, Former members): in the address as `?m=<uid>`,
// so a shared link opens them and back works. From 1024 the member shows in the pane beside the list and
// each open or close is its own history entry. Below 1024 the bottom sheet takes its own entry, as before
// (sheet-close.ts), so the address is only replaced. `wide` is null until the browser has said its width.
import { useEffect, useState, useSyncExternalStore } from "react";

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

/** The address with `m` set to this uid, or without it. */
function write(uid: number | null, push: boolean) {
  const url = new URL(window.location.href);
  if (uid === null) url.searchParams.delete("m");
  else url.searchParams.set("m", String(uid));
  window.history[push ? "pushState" : "replaceState"](window.history.state, "", url);
}

/** `initial` is `?m=` as the page was asked for. */
export function useOpenMember(initial: string | null) {
  const wide = useWide();
  const [open, setOpen] = useState(() => uidOf(initial));
  useEffect(() => {
    const sync = () => setOpen(uidOf(new URLSearchParams(window.location.search).get("m")));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return {
    open,
    wide,
    /** Opens a member; `step` (the arrow keys) moves the open row without a history entry each time. */
    show(uid: number, step = false) {
      if (uid === open) return;
      write(uid, wide === true && !step);
      setOpen(uid);
    },
    close() {
      write(null, wide === true);
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
