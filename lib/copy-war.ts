// The event page's war sections (#271, #280): war turnout and kill share vs might share. Public, so every key is
// translated (D48); lib/copy.ts spreads it into ledger, so a key's path is still ledger.<key>.
export const warCopy = {
  /** The event page's section on kills gained by members (#271); no figure is about one person. */
  fought: "War turnout",
  /** The title while the event has no End: the figures are as of each alliance's latest sample. */
  foughtSoFar: "War turnout so far",
  /** Under the section's title: what the figures count. */
  foughtHelp:
    "Members who were in the alliance at Start and at End. Support players gain no kills.",
  /** The help line while the title is `foughtSoFar`: there is no End yet. */
  foughtSoFarHelp:
    "Members who were in the alliance at Start and at its latest reading. Support players gain no kills.",
  /** The first list: members with kills gained, as a share of the members in both reads. */
  withKills: "Members with kills gained",
  /** The second list: the alliance's five biggest kills gains, as a share of all its kills gained. */
  topShare: "Kills from the top 5 members",
  /** Under the second list's title: what its figure says. */
  topShareHelp:
    "Share of the alliance's kills made by its 5 biggest gainers. Higher means fewer players carried it.",
  /** After that share: how many of the alliance's gainers it is the top of, `5 of 47`. */
  topBasis: "{top} of {n}",
  /** After that share, for an alliance with under 10 gainers: the figure is not ranked. */
  fewGainers: "few gainers",
  /** The event page's section after the war turnout (#280, D83): kill share against might share. */
  carried: "Kill share vs might share",
  /** Under the title: what the two shares are and who gains no kills. */
  carriedHelp:
    "Each alliance's share of the kills gained from Start to End, next to its share of the might at Start. Defenders and support players gain no kills.",
  /** Under the help: which rows are shown. */
  carriedShown: "The alliances whose kill share is furthest above their might share, and yours.",
  /** `{n}` alliances, their kills gained and their might at Start (all as compact numbers). */
  carriedTotal: "All {n} alliances: {kills} kills gained, {might} might at Start",
  /** The legend: the square mark and the round mark on each row. */
  carriedMightMark: "Might share at Start",
  carriedKillsMark: "Kill share gained",
  /** A row's figures. */
  carriedShares: "Might {might} · Kills {kills}",
  carriedTurnout: "{share} with kills",
  /** The ratio's range over the alliance's events: `1.8×–2.9× over 4 events`. */
  carriedSpread: "{low}–{high} over {n} events",
  /** The figure's meaning, and when the ratio's range is shown. */
  carriedRatioHelp:
    "pts is the kill share minus the might share. From 3 events, the range of kill share ÷ might share over those events is shown under it.",
  /** After a gap in percentage points, `+6.1 pts`. */
  carriedPoints: "pts",
} as const;
