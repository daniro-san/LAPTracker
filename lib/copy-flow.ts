// The member flow page's words (D89, #275), the public strings of `en.flow`, written in every language
// (D48). Split out of lib/copy.ts for its size. Counts between alliances only: no member is named, and
// moves of a few members are hidden.
export const flowCopy = {
  title: "Member flow",
  /** The chip beside the title. */
  tag: "Counts only",
  lead: "Where members moved between the tracked alliances, from the first day to the second. No member is named.",
  from: "From",
  to: "To",
  action: "Show",
  /** `{from}` and `{to}` are days; `{source}` and `{dest}` are alliances, `{n}` the members of that move. */
  answer: "Between {from} and {to}, the largest move was {source} → {dest} ({n}).",
  /** When no move is big enough to show: `{min}` is the smallest move shown. */
  answerNone:
    "Between {from} and {to}, no move of {min} or more members between the tracked alliances.",
  /** The line under it, counts of the moves shown: between two tracked alliances, from outside them, out of
   * them; `{min}` is the smallest move shown. Keep " · " between the parts: the page splits on it so each
   * part stays on one line. */
  totals: "Moves of {min} or more · Changed alliance: {moved} · New: {arrived} · Left: {left}",
  /** Said on the page: why some moves are missing. `{min}` is the smallest move shown. */
  small:
    "Counts under {min} members are hidden and left out of every total, including members who stayed. This protects small groups.",
  /** The row for members in no tracked alliance on the first day, and the column for those in none on the second. */
  rowNew: "New",
  colLeft: "Left",
  /** `{from}` and `{to}` are days. */
  legend:
    "Rows: the alliance on {from}. Columns: the alliance on {to}. New: in no tracked alliance on {from}. Left: in none on {to}.",
  caption: "Members by alliance on {from} (rows) and on {to} (columns)",
  stayed: "Stayed",
  /** A phone row whose members all stayed: `{n}` of them. */
  rowStayed: "Stayed: {n}",
  newTitle: "New to the tracked alliances",
  leftTitle: "Left the tracked alliances",
  /** `{list}` is alliance names. */
  notCounted: "Not counted, no usable read on both days: {list}.",
  /** Under the picker: the two days are not in order. */
  order: "Choose a From day earlier than the To day.",
  none: "Fewer than two days have a usable read yet.",
} as const;
