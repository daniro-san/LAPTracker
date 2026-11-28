// Every alliance on the server (D133, issue 459), `copy.alliances` in lib/copy.ts: the "All alliances" page,
// the ledger's link to it, and an alliance page's ranks board line and "Get today's details". Public:
// translated like the rest of the public pages (lib/i18n).
export const alliancesCopy = {
  title: "All alliances",
  description: "Every alliance on the server's ranks board, by might.",
  /** Under the title. `{n}`: how many are read every day (20). */
  lead: "Every alliance on the server's ranks board, by might. The top {n} are read every day, with their members and history.",
  /** The board's date: `Ranks board of Nov 20`. */
  asOf: "Ranks board of {date}",
  /** The first group's heading. */
  tracked: "Read every day",
  /** The second group's heading: the rest of the board. */
  more: "More alliances",
  /** Under "More alliances": what a press on one of them gives. */
  moreNote: "Only the ranks board's numbers. Open one to see or get today's details.",
  /** The pager: `Page 2 of 4`. */
  page: "Page {page} of {pages}",
  previous: "Previous",
  next: "Next",
  /** The recruiting section's heading (issue 792; the owner's words, 2026-11-28): alliances with room. */
  recruiting: "Alliances recruiting",
  /** Under it, one plain line (the owner's words). */
  recruitingLead: "Alliances with room right now, and what they ask to join.",
  /** No alliance read in that time has room. `{days}`: how many days back a read still counts (2). */
  recruitingNone: "No alliance read in the last {days} days has a spot free.",
  /** A row's free places: `27 spots free (73/100)`. */
  spotsFree: "{n} spots free ({members}/{capacity})",
  spotFree: "1 spot free ({members}/{capacity})",
  /** A row's least might to join, `{might}` compact (`8M`). */
  minMight: "Minimum might {might}",
  /** A row's least headquarters level to join (`14`). */
  minHq: "Minimum HQ {level}",
  /** Before the first board was read. */
  none: "The list fills after tonight's daily update.",
  /** The ledger's link under its table: `All 98 alliances on the server`. */
  link: "All {n} alliances on the server",
  /** An alliance page's board line: `Ranks board of Nov 20: #23 by might (412M) · #31 by kills (3.10M)`. */
  board: "Ranks board of {date}: #{rank} by might ({might}) · #{killsRank} by kills ({kills})",
  /** The same when the alliance is on the might board only. */
  boardMight: "Ranks board of {date}: #{rank} by might ({might})",
  /** An alliance with no member list stored. */
  noRoster: "No member list for this alliance yet.",
  /** The details box (the owner's words, 2026-11-20). */
  notDaily: "Details for this alliance aren't read every day.",
  get: "Get today's details",
  getNote: "One lookup a day, shared with everyone.",
  getting: "Getting today's details…",
  /** After a lookup today: `Details from today, 14:05 server time · anyone can get them again tomorrow`. */
  got: "Details from today, {time} · anyone can get them again tomorrow",
  usedUp: "Today's lookups are used up, try again tomorrow.",
  failed: "Today's lookup didn't work. Try again tomorrow.",
  eventPause: "Lookups pause while the weekly event runs. Try again after it.",
  tooMany: "Too many lookups from here just now. Try again in a few minutes.",
  /** Any other answer, or no answer. */
  error: "Something went wrong. Try again in a moment.",
} as const;
