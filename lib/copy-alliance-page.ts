// The public alliance page, /alliances/[unionId] (issue 822), `copy.alliancePage` in lib/copy.ts: its head's
// facts, the growth card (shared with the player page, issue 824) and the member list. Public: translated like
// the rest of the public pages (lib/i18n).
export const alliancePageCopy = {
  /** A head fact: the game server's number (`325`). */
  server: "Server",
  /** A head fact: the alliance's place by might on the server's ranks board (`#2`). */
  serverRank: "Server rank",
  /** The growth card's heading. */
  growth: "Growth",
  /** The range links' group label. */
  range: "Range",
  /** A range link: `7d`, `30d`, `90d`. */
  days: "{n}d",
  /** Under a growth chart: `+258.8M over 7 days`, the change from the range's first reading to its last. */
  over: "{change} over {n} days",
  overOne: "{change} over 1 day",
  /** The same when nothing changed. */
  same: "No change over {n} days",
  sameOne: "No change over 1 day",
  /** The tabs' group label. */
  sections: "Alliance sections",
  /** The member list's tab: `Members (97)`. */
  membersTab: "Members ({n})",
  historyTab: "History",
  /** The joins and leaves tab with the net change of the last 7 days: `Joins & leaves (−2)`. */
  movesTab: "Joins & leaves ({n})",
  /** Its counts' headings. */
  week: "Last 7 days",
  month: "Last 30 days",
  /** A count: `+4` above it. */
  net: "net",
  /** The filters' group label, and the filters. */
  filters: "Show",
  all: "All",
  joinedFilter: "Joined",
  leftFilter: "Left",
  /** One person's line: `[TAG]` is the alliance they came from or went to. */
  joinedFrom: "Joined · from {tag}",
  leftTo: "Left · to {tag}",
  /** The other side is an alliance we do not read every day: never "no alliance now". */
  joinedUntracked: "Joined · was not in a tracked alliance",
  leftUntracked: "Left · not in a tracked alliance",
  /** Under the counts: how the other alliance is found. */
  movesNote: "From the daily updates: each day's members compared with the day before by player.",
  /** No change in the window, and fewer than two daily updates to compare. */
  movesNone: "No one joined or left in the last 30 days.",
  movesFirst: "Joins and leaves show from the second daily update.",
  /** Above the member list: the read the three per-member figures come from. */
  read: "As read on {date}: quest points since Monday, and that day's Alliance Help coins and tech donated.",
  /** A member's chips, beside their number. */
  active: "Quest points",
  coins: "Help coins",
  tech: "Tech donated",
} as const;
