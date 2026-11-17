// The merge simulator's words (D84, #282), the public strings of `en.merge`, written in every language
// (D48). Split out of lib/copy.ts for its size. Totals only: no member is named.
export const mergeCopy = {
  title: "Merge simulator",
  /** The chip beside the title: the page is arithmetic, not advice. */
  tag: "Simulation only",
  lead: "Two alliances counted as one and checked against the member cap. Alliance totals only, no member names.",
  /** The alliance page's link. */
  link: "Simulate a merge",
  first: "First alliance",
  second: "Second alliance",
  choose: "Choose an alliance",
  action: "Simulate",
  swap: "Swap the alliances",
  pick: "Choose two alliances to see the result.",
  same: "Pick two different alliances.",
  /** `{all}` and `{within}` are ranks (`#1`); `{cap}` the merged alliance's cap. */
  answer: "Together: {all} with everyone, {within} within the cap of {cap}",
  /** When every member fits, the two ranks are the same. */
  answerFits: "Together: {all}. All {n} members fit the cap of {cap}",
  /** The one-sentence rule: which cap and which members count. */
  rule: "How it is counted: the merged alliance gets the larger of the two stored caps ({cap}). Within the cap means its strongest members by might. A member in both lists counts once.",
  capAssumed: "Neither alliance has a stored cap, so {cap} is assumed.",
  membersTitle: "Members and the cap",
  mightTitle: "Might",
  rankTitle: "Rank among the other tracked alliances",
  together: "Together",
  withEveryone: "With everyone",
  withinCap: "Within the cap",
  leftOut: "Would not fit",
  inBoth: "In both lists",
  cap: "cap {cap}",
  /** A notice under the members bars. */
  over: "{n} over the cap of {cap}",
  /** A side's line in the turnout list: `{gainers}` of `{n}` members gained kills. */
  turnout: "{gainers} of {n} members gained kills",
  noTurnout: "no war turnout yet",
} as const;
