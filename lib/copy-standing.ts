// The alliance page's "Standing over time" section (D90, issue 274), `copy.standing` in lib/copy.ts.
// Public: translated like the rest of the public pages (lib/i18n). Neutral wording: ranks and arithmetic,
// never a verdict on an alliance. "The server" is always said as the tracked alliances' total.
export const standingCopy = {
  title: "Standing over time",
  /** Under the title: what is ranked, what the server is and which days count. */
  help: "The tracked alliances ranked by might from each day's read, with the change since {from}. A day on which an alliance was not read is left out. The server here is the tracked alliances' total.",
  /** The first sentence. `{label}` is the alliance, `{rank}` its rank (`#4`), `{move}` one of up, down or held. */
  lead: "{label} is {rank} by might, {move} since {from}.",
  /** `{n}` places. */
  up: "up {n}",
  down: "down {n}",
  held: "unchanged",
  /** After the lead; `{growth}` and `{server}` are signed percents. */
  leadGrowth:
    "Its might changed {growth} since then; the tracked alliances' total changed {server}.",
  /** The first row of the list: the tracked alliances together. */
  server: "Tracked alliances",
  /** Beside each row's might: its change since the period's first day, `{growth}` a signed percent. */
  growthSince: "{growth} since {from}",
  /** The sparkline's accessible name; `{first}` and `{last}` are ranks (`#6`), `{from}` and `{to}` dates. */
  trend: "Rank {first} on {from}, {last} on {to}",
  /** Marks the page's own alliance in the list, for screen readers. */
  thisAlliance: "This alliance",
  /** Details: the ranks day by day. `{days}` are the dates, oldest first. */
  detailsHelp: "Rank on each day, oldest first: {days}.",
  few: "Not enough daily reads yet to compare the alliances.",
};
