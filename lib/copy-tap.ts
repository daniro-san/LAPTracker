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
  /** A pulse interval in the readout: its kills and how many alliances were read in it. */
  readoutPulse: "{kills} kills gained · {n} alliances read",
  /** One event's slot in the strips' readout: its share of the event's kills, and the kills. */
  readoutShare: "{share} ({kills} kills)",
  /** After a line chart's value when the reading was an event's Start or End, not a daily read. */
  readoutEventRead: "event reading",
  /** Under the readout: opens the chosen interval's kills split by alliance, in the chart's place. */
  splitLink: "{span} by alliance ›",
  /** The path's accessible name over a chart's next level. */
  drillPath: "Where you are in this chart",
  /** The path's Back step from an interval's split to the whole pulse or strip. */
  splitBack: "All intervals",
  /** Under an interval's split: its kills are the alliances' added up. */
  splitSum: "{kills} kills gained in {span}: the {n} alliances read in both readings, added up.",
  /** The alliances an interval left out, because one of its two readings of them was missing or stale. */
  splitLeftOutOne: "{n} alliance was not read in both readings and is left out.",
  splitLeftOutOther: "{n} alliances were not read in both readings and are left out.",
  /** The fight clock counts a loss as no gain: said when the alliances' sum is below 0. */
  splitLoss: "Together they lost kills here; the fight clock counts that as 0.",
  /** The key to the split's bars. */
  splitKey: "Each bar: the alliance's share of the interval's kills.",
} as const;
