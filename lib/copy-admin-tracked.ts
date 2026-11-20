// /admin's Tracked alliances card (D133, issue 459), as `copy.admin.tracked`. English only (D48). lib/copy.ts
// takes the admin copy from here, with the card's words added, because lib/copy.ts and lib/copy-admin.ts are
// at the 300-line limit.
import { adminCopy as base } from "./copy-admin";

export const trackedAdminCopy = {
  title: "Tracked alliances",
  help: "The top {n} by might on the ranks board, read before each daily update. They are read every day and by the next event's Start. Workspaces' alliances are read every day too.",
  /** The newest set: `Nov 20 · from the ranks board · 20 alliances`. */
  set: "{day} · {source} · {n} alliances",
  source: {
    board: "from the ranks board",
    previous: "the board could not be read: the day before's kept",
    event: "before the first board: the newest event's list",
  },
  none: "No tracked set yet: the first is made before tonight's daily update.",
  changes: "Changes",
  /** One day's change: `Nov 20: in [ABC] Alpha · out [XYZ] Zulu`. */
  change: "{day}: {list}",
  in: "in {list}",
  out: "out {list}",
  noChange: "No change in the last {n} days.",
  lookups: "Today's detail lookups",
  /** `3 of 30 · 6 calls`. */
  lookupsCount: "{n} of {max} · {calls} calls",
  /** One lookup: `[ABC] Alpha · 14:05 · done`. */
  lookup: "{alliance} · {time} · {state}",
  state: {
    running: "running",
    done: "done",
    refused: "refused: the quota reserve",
    failed: "failed ({error})",
  },
  noLookup: "No lookup today.",
} as const;

/** The admin area's text with the Tracked alliances card: `copy.admin` in lib/copy.ts. */
export const adminCopy = { ...base, tracked: trackedAdminCopy };
