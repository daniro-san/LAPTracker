// What a tap on a public chart opens (D158 rule 7, issue 736): the arrival line on the alliance page's member
// list when a War turnout or Kill share row opened it, and the readout under a pulse or a line chart with its
// 44 px steps. Public, so every key is translated (D48); lib/copy.ts spreads it into ledger, so a key's path
// is ledger.<key>.
export const tapCopy = {
  /** Above the member list a War turnout row opened, sorted by ± Kills. */
  arrivedTurnout: "From War turnout: sorted by kills gained in this event, most first.",
  /** The same from a Kill share vs might share row. */
  arrivedKillShare:
    "From Kill share vs might share: sorted by kills gained in this event, most first.",
  /** The × beside the arrival line: the list in its usual order. */
  arrivedClear: "Show the usual order",
  /** The readout's two steps under a pulse or a line chart. */
  readoutEarlier: "Earlier",
  readoutLater: "Later",
} as const;
