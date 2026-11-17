// What closing a sheet does (lib/brand/components/Sheet.tsx), pure so it can be tested: whether a close
// closes, asks first ("Discard your changes?") or is refused, what counts as a tap on the backdrop, and
// the phone's back button. Every open modal sheet owns one history entry at the same address, marked in
// history.state with how many sheets were open (`lapSheet`); a popstate that lands on an entry with fewer
// closes the sheet on top; a forward step closes nothing and is stepped back off. Closing a sheet any
// other way takes its entry off again; that back lands on an entry marked with the sheets still open, so
// it closes nothing.

/** A close was asked for (Close, Cancel, Escape, the backdrop, back): what happens. */
export function closeStep(dirty: boolean, closable: boolean): "close" | "ask" | "stay" {
  if (!closable) return "stay";
  return dirty ? "ask" : "close";
}

/** True when any field of `now` differs from `start` (the form's unsaved changes). */
export function changedFrom<T extends object>(start: T, now: T): boolean {
  const keys = new Set([...Object.keys(start), ...Object.keys(now)]) as Set<keyof T>;
  return [...keys].some((k) => !Object.is(start[k], now[k]));
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A point outside the card's box: on the backdrop. */
export const outside = (box: Box, x: number, y: number) =>
  x < box.left || x > box.right || y < box.top || y > box.bottom;

/**
 * A tap on the backdrop: the press began there and ended there. A drag that starts in a field and is let
 * go over the backdrop (selecting text) is not one.
 */
export const backdropTap = (pressedOutside: boolean, releasedOutside: boolean) =>
  pressedOutside && releasedOutside;

export interface HistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/** Back on a sheet: "closed" lets its entry go; "stay" puts the entry back (the sheet asks or cannot close). */
export type OnBack = () => "closed" | "stay";

const MARK = "lapSheet";

/** How many sheets were open on the history entry with this state; 0 for a page's own entry. */
export function sheetDepth(state: unknown): number {
  const mark =
    typeof state === "object" && state !== null ? (state as Record<string, unknown>)[MARK] : 0;
  return typeof mark === "number" ? mark : 0;
}

export function sheetHistory(history: HistoryLike) {
  const open: OnBack[] = [];
  // The router's own state is kept; only the mark is added.
  const push = (depth: number) =>
    history.pushState({ ...(history.state as object | null), [MARK]: depth }, "");
  return {
    /** A sheet opened: one entry for it. Returns what to call when it closes by any other way than back. */
    open(onBack: OnBack): () => void {
      open.push(onBack);
      push(open.length);
      return () => {
        const at = open.indexOf(onBack);
        if (at === -1) return;
        open.splice(at, 1);
        // Lands on an entry marked with the sheets still open: popped() closes nothing.
        history.back();
      };
    },
    /** The browser moved in the history (popstate) to an entry with this state. */
    popped(state: unknown) {
      const depth = sheetDepth(state);
      // Forward onto the entry of a sheet that is closed now: step back off it, so it stays a no-op and
      // the next back closes the sheet on top. That back lands at the open sheets' depth: nothing closes.
      if (depth > open.length) return history.back();
      if (depth === open.length) return;
      // Off the stack before it answers: a sheet that closes now must not take a second entry off.
      const top = open.pop();
      if (!top || top() === "closed") return;
      open.push(top);
      push(open.length);
    },
  };
}

let shared: ReturnType<typeof sheetHistory> | null = null;

/** The page's one stack of sheets, listening to popstate once. Browser only. */
export function pageSheets() {
  if (!shared) {
    const sheets = sheetHistory(window.history);
    window.addEventListener("popstate", (e) => sheets.popped(e.state));
    shared = sheets;
  }
  return shared;
}
