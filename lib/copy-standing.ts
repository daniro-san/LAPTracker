// The alliance page's "Standing over time" section (D90, issue 274), `copy.standing` in lib/copy.ts.
// Public: translated like the rest of the public pages (lib/i18n). Neutral wording: ranks and arithmetic,
// never a verdict on an alliance. "The server" is always said as the tracked alliances' total.
export const standingCopy = {
  title: "Standing over time",
  /** Under the title: what is ranked, what the server is and which days count. */
  help: "The tracked alliances ranked by might from each daily update, with the change since {from}. A day with no update for an alliance is left out. The server here is the tracked alliances' total.",
  /** The first sentence, in time order (issue 473). `{label}` is the alliance, `{before}` its rank on the
   * period's first day and `{rank}` on its newest (`#4`), `{from}` and `{to}` those days. */
  lead: "By might, {label} went from {before} on {from} to {rank} on {to}.",
  /** After the lead; `{growth}` and `{server}` are signed percents. */
  leadGrowth:
    "Its might changed {growth} since then. The tracked alliances' total changed {server}.",
  /** The first row of the list: the tracked alliances together. */
  server: "Tracked alliances",
  /** Beside each row's might: its change since the period's first day, `{growth}` a signed percent. */
  growthSince: "{growth} since {from}",
  /** The sparkline's accessible name; `{first}` and `{last}` are ranks (`#6`), `{from}` and `{to}` dates. */
  trend: "Rank {first} on {from}, {last} on {to}",
  /** The chip on the page's own alliance row in the list. */
  thisAlliance: "This alliance",
  /** Details: the ranks day by day. `{days}` are the dates, oldest first. */
  detailsHelp: "Rank on each day, oldest first: {days}.",
  few: "Not enough daily updates yet to compare the alliances.",
  /** Under the list: alliances read before the period but not in it. `{list}` is alliance names. */
  notRanked: "Not ranked, no usable daily update in this period: {list}.",
};
