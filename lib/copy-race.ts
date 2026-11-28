// /alliances' "Race to #1" section (issue 285), `copy.race` in lib/copy.ts. Public: translated like the rest of
// the public pages (lib/i18n). A pace is arithmetic, never a forecast: always "at this pace", never "will".
export const raceCopy = {
  title: "Race to #1",
  /** Under the title. `{weeks}`: weeks ahead (4); `{n}`: Saturday-to-Saturday changes (3); `{from}`, `{to}`:
   * the first and last Saturday. */
  lead: "Each alliance's place by might today, and its place in {weeks} weeks at this pace. The pace is the middle of its last {n} weekly changes, Saturday to Saturday, {from} to {to}.",
  /** The left column's heading. */
  today: "Today",
  /** The right column's heading: `In 4 weeks`. */
  ahead: "In {weeks} weeks",
  /** The readout after the alliance: `{places}` is `#2 → #1`, `{pace}` a signed compact might (`+2.1M`),
   * `{low}` and `{high}` the might change of the slowest and of the fastest of those weeks, signed. */
  line: "{places} in {weeks} weeks at this pace · {pace} a week (slowest week {low}, fastest week {high})",
  /** Under the chart: what the places are counted among. */
  among:
    "Places among the {n} alliances with a pace. Alliances recruit, merge and fight, so a pace can change.",
  /** An alliance left out: its members changed by more than 10 % in those weeks. */
  moved: "{label}: membership changed a lot",
  /** An alliance left out: not a usable daily update on each of those Saturdays. */
  few: "{label}: not enough weeks yet",
  /** No alliance has a pace. `{n}`: changes needed (3). */
  none: "Not enough weeks yet. A pace needs {n} weekly changes, Saturday to Saturday.",
  /** The readout's steps. */
  previous: "Previous alliance",
  next: "Next alliance",
};
