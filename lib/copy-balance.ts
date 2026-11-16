// The server balance page's words (D85, issue 283), `copy.balance` in lib/copy.ts. Public: translated like
// the rest of the public pages (lib/i18n), split out for lib/copy.ts's length. Neutral wording: shares of
// might and arithmetic, never a verdict on an alliance.
export const balanceCopy = {
  title: "Server balance",
  description:
    "Each tracked alliance's share of the server's might, and a hypothetical bloc builder.",
  /** The first sentence: `{max}` is the greatest share rounded up to a whole percent, `{n}` is 3, `{top}` their share. */
  lead: "No alliance holds more than {max} of the server's might; the top {n} hold {top}.",
  /** Under the lead: what is counted, in one line. */
  includes: "Might includes buildings and tech.",
  /** `{n}` tracked alliances, `{date}` the newest read. */
  basis: "{n} tracked alliances, read {date}.",
  total: "Server might",
  shares: "Share of server might",
  /** The stacked bar's accessible name: the shares, greatest first. */
  bar: "Share of server might by alliance: {list}",
  /** An alliance read before the newest day: `as of Nov 14`. */
  asOf: "as of {date}",
  none: "No daily reads yet.",
  builder: "Bloc builder",
  hypothetical: "Hypothetical",
  builderHelp:
    "Tap A or B on an alliance to try a bloc. This is arithmetic, not a forecast, and not an announcement.",
  bloc: "Bloc {bloc}",
  blocShare: "{share} of the server's might",
  blocAlliances: "Alliances",
  blocEmpty: "No alliance yet",
  noBloc: "Not in a bloc",
  clear: "Clear blocs",
  /** The tap's accessible names; `{bloc}` is A or B. */
  addTo: "Add {alliance} to bloc {bloc}",
  removeFrom: "Remove {alliance} from bloc {bloc}",
  trend: "Top {n} share over time",
  trendHelp:
    "Share of the tracked alliances' might held by the {n} greatest, from each day's read. A day on which an alliance was not read is left out.",
  trendLabel: "Top {n} share",
  /** `{last}` and `{first}` are shares, `{to}` and `{from}` dates. */
  trendSummary: "The top {n} hold {last} on {to}, {first} on {from}.",
  trendFew: "Not enough daily reads yet to draw a trend.",
  day: "Day",
};
