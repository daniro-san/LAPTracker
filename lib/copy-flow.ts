// The member flow page's words (D89, #275), the public strings of `en.flow`, written in every language
// (D48). Split out of lib/copy.ts for its size. Counts between alliances only: no member is named, and
// moves of a few members are hidden.
export const flowCopy = {
  title: "Member flow",
  /** The chip beside the title. */
  tag: "Counts only",
  lead: "Where members went between the tracked alliances: the alliance each one was in on the first day, set against the second. Counts only, no member names.",
  from: "From",
  to: "To",
  action: "Show",
  /** `{from}` and `{to}` are days; `{moved}` members changed alliance; `{source}` and `{dest}` are alliances, `{n}` the move. */
  answer:
    "Between {from} and {to}, {moved} members changed alliance; the largest move was {source} → {dest} ({n}).",
  /** When every move is under the threshold: `{min}` is the smallest move shown. */
  answerSmall:
    "Between {from} and {to}, {moved} members changed alliance; no single move reached {min}.",
  answerNone: "Between {from} and {to}, no member changed alliance.",
  /** The line under it: members who came from, or went to, no tracked alliance. */
  outside: "{arrived} came from outside the tracked alliances and {left} left them.",
  /** Said on the page: why some moves are missing. `{min}` is the smallest move shown. */
  small:
    "Moves of fewer than {min} members are hidden, so nobody can be picked out of a small group.",
  /** The row for members in no tracked alliance on the first day, and the column for those in none on the second. */
  rowNew: "New",
  colLeft: "Left",
  /** `{from}` and `{to}` are days. */
  legend:
    "Rows: the alliance on {from}. Columns: the alliance on {to}. New: in no tracked alliance on {from}. Left: in none on {to}.",
  caption: "Members by alliance on {from} (rows) and on {to} (columns)",
  stayed: "Stayed",
  /** A row's summary on a phone: `{n}` members on the first day. */
  rowMembers: "{n} members",
  newTitle: "New to the tracked alliances",
  leftTitle: "Left the tracked alliances",
  /** `{list}` is alliance names. */
  notCounted: "Not counted, no usable read on both days: {list}.",
  /** Under the picker: the two days are not in order. */
  order: "Choose a From day earlier than the To day.",
  none: "Fewer than two days have a usable read yet.",
} as const;
