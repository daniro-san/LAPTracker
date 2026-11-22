// The words of the Insights page's "Effort at every might level" (issue 489), pure: what the groups rest on
// and who is left out, the groups' members behind a tap once (#678: "Who is in each group", never beside a
// median), and each measure's groups as the rows its HTML bars draw (D68). A missing number is "—" (NONE).
import { fill } from "../copy";
import { calendarDates } from "./calendar-words";
import { NONE } from "./fact-text";
import type { InsightsView } from "./insights";
import { compact, counted, whole, type Formats } from "./insights-format";
import { EFFORT_METRICS, EFFORT_MIN_READS } from "./insights-rules";
import { setOf, type MemberSet } from "./insights-sets";
import type { InsightsWords } from "./insights-words";
import { COINS_MAX } from "./member-days";

export function effortWords(
  e: NonNullable<InsightsView["effort"]>,
  people: InsightsView["people"],
  f: Formats,
): InsightsWords["effort"] {
  const { t, language } = f;
  const dates = calendarDates(language);
  // Each kind's words and members: "1 new" and "2 new" (PT "1 novo", FR "1 nouveau") take their own form.
  const left = (
    [
      [counted(t, "insights.effort.fresh", e.leftOut.fresh.length, language), e.leftOut.fresh],
      [fill(t["insights.effort.away"], { n: e.leftOut.away.length }), e.leftOut.away],
      [fill(t["insights.effort.noMight"], { n: e.leftOut.noMight.length }), e.leftOut.noMight],
    ] as const
  ).filter(([, uids]) => uids.length > 0);
  const rangeLabel = (b: (typeof e.bands)[number]) =>
    fill(t["insights.effort.band"], {
      low: compact(b.low, language),
      high: compact(b.high, language),
    });
  const based = [
    counted(t, "insights.effort.based", e.reads, language, {
      range:
        e.from === e.to
          ? dates.dayMonth(e.to)
          : `${dates.dayMonth(e.from)} – ${dates.dayMonth(e.to)}`,
      members: e.members,
    }),
    ...(e.reads < EFFORT_MIN_READS ? [fill(t["insights.effort.few"], { n: e.reads })] : []),
    ...(left.length > 0
      ? [
          fill(t["insights.effort.leftOut"], {
            list: left.map(([label]) => label).join(", "),
          }),
        ]
      : []),
  ];
  const groups = EFFORT_METRICS.map((k) => {
    const top =
      k === "coins" ? COINS_MAX : Math.max(0, ...e.bands.map((b) => b.medians[k]?.value ?? 0));
    return {
      label: t[`insights.effort.${k}`],
      rows: e.bands.map((b) => {
        const m = b.medians[k];
        return {
          label: rangeLabel(b),
          // Coins stop at 1,000: the plain number, never "1.00K".
          value: m ? (k === "coins" ? whole(m.value, language) : compact(m.value, language)) : NONE,
          share: m && top > 0 ? Math.min(1, m.value / top) : null,
          note: fill(t["insights.effort.members"], { n: b.uids.length }),
        };
      }),
    };
  });
  return {
    based,
    // With too few daily updates there are no groups and so no names (D139). New members stay a count:
    // newcomers are "Aggregate only" (owner, 2026-11-20) until the owner says otherwise (#678).
    leftOut: (e.bands.length > 0 ? left : [])
      .filter(([, uids]) => uids !== e.leftOut.fresh)
      .map(([label, uids], i) => ({
        label,
        set: setOf("effort_left_out", `left-${i}`, uids, people, language) as MemberSet,
      })),
    ranges: e.bands.map((b, i) => ({
      label: rangeLabel(b),
      value: fill(t["insights.effort.members"], { n: b.uids.length }),
      share: null,
      set: setOf("effort_range", `range-${i}`, b.uids, people, language),
    })),
    groups,
    quiet: e.quiet.map((q) => ({ uid: q.uid, name: q.name })),
  };
}
