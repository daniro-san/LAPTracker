// What closing a sheet does (lib/brand/components/Sheet.tsx), pure so it can be tested: whether a close
// closes, asks first ("Discard your changes?") or is refused, and the phone's back button. Every open
// modal sheet owns one history entry at the same address; back closes only the sheet on top; closing a
// sheet any other way takes its entry off again, and that programmatic back is not read as the officer's.

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

export interface HistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/** Back on a sheet: "closed" lets its entry go; "stay" puts the entry back (the sheet asks or cannot close). */
export type OnBack = () => "closed" | "stay";

export function sheetHistory(history: HistoryLike) {
  const open: OnBack[] = [];
  let ours = 0;
  return {
    /** A sheet opened: one entry for it. Returns what to call when it closes by any other way than back. */
    open(onBack: OnBack): () => void {
      history.pushState(history.state, "");
      open.push(onBack);
      return () => {
        const at = open.indexOf(onBack);
        if (at === -1) return;
        open.splice(at, 1);
        ours += 1;
        history.back();
      };
    },
    /** The browser went back (popstate). */
    popped() {
      if (ours > 0) {
        ours -= 1;
        return;
      }
      // Off the stack before it answers: a sheet that closes now must not take a second entry off.
      const top = open.pop();
      if (!top || top() === "closed") return;
      open.push(top);
      history.pushState(history.state, "");
    },
  };
}

let shared: ReturnType<typeof sheetHistory> | null = null;

/** The page's one stack of sheets, listening to popstate once. Browser only. */
export function pageSheets() {
  if (!shared) {
    const sheets = sheetHistory(window.history);
    window.addEventListener("popstate", () => sheets.popped());
    shared = sheets;
  }
  return shared;
}
