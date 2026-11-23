// The Insights page's sections (issue 489), server-rendered: one drawn card per section, each opening with
// what it rests on, then HTML bars (D68: hand-built, the label and the number in HTML beside every bar,
// token colours, nothing hover-only). A missing number is the NoData mark, never 0 (D75). A count that
// stands for a set of members opens its names (issue 678), in name order with nothing beside a name. A week row
// of the pulse or the flow opens that week's days in the chart's place (D158 rule 7 (b), InsightsDays.tsx).
// The effort card is in InsightsEffort.tsx.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import {
  levelHref,
  type FlowDaysWords,
  type FlowDayWords,
  type InsightsLevels,
  type PulseDaysWords,
  type PulseDayWords,
} from "@/lib/private/insights-days-words";
import type { InsightsWords } from "@/lib/private/insights-words";
import { fill } from "@/lib/words";

import { Bars, Card, FLOW_CARD, PULSE_CARD, RowBody, Sub, type LevelNav } from "./InsightsBars";
import {
  DayPicks,
  Days,
  FlowDay,
  FlowDays,
  PulseDay,
  PulseDays,
  type DayHrefs,
} from "./InsightsDays";
import { InsightsDrillLink } from "./InsightsDrillLink";
import { Caret, membersHref, Names, SetFold, TapHint } from "./InsightsSets";
import { withNoData } from "./NoData";

/** A card's level links: the card itself, a week of it (null: this week) and a day of it. */
function dayHrefs(nav: LevelNav, card: string, week: "pulse" | "flow"): DayHrefs {
  const day = week === "pulse" ? "pulseDay" : "flowDay";
  const at = (change: Partial<InsightsLevels>) => levelHref(nav.base, nav.levels, change, card);
  return {
    top: at({ [week]: null, [day]: null }),
    week: (monday) => at({ [week]: monday, [day]: null }),
    day: (d) => at({ [day]: d }),
  };
}

export function PulseCard({
  pulse,
  level,
  day,
  nav,
  t,
  noData,
  slug,
}: {
  pulse: NonNullable<InsightsWords["pulse"]>;
  /** The week the address opens to its days, in the card's place; null for the card itself. */
  level: PulseDaysWords | null;
  /** The day the address opens to who reached each measure; it comes before the week. */
  day: PulseDayWords | null;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const hrefs = dayHrefs(nav, PULSE_CARD, "pulse");
  return (
    <Card id={PULSE_CARD} title={t["insights.pulse.head"]} based={level || day ? [] : pulse.based}>
      {day ? (
        <PulseDay level={day} {...{ hrefs, t, noData, slug }} />
      ) : level ? (
        <PulseDays level={level} hrefs={hrefs} t={t} noData={noData} />
      ) : (
        <>
          <DayPicks
            label={t["drill.pulse.pick"]}
            picks={pulse.picks}
            href={hrefs.day}
            kind="pulse_day"
          />
          {pulse.metrics.map((m) => (
            <div key={m.label} className="mt-3 border-t-2 border-rule pt-2">
              <h3 className="font-semibold">{m.label}</h3>
              <p className="text-body-sm tabular-nums">{withNoData(m.latest, noData)}</p>
              <Days days={m.days} noData={noData} />
              <p className="mt-2 text-[12px] font-semibold text-ink/70 uppercase">
                {t["insights.pulse.weeks"]}
              </p>
              <Bars rows={m.weeks} noData={noData} drill={nav} />
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

/** A week's label and its joined and left bars side by side; the count of a set that opens is plum. */
function WeekBars({ w, noData }: { w: FlowWeek; noData: string }) {
  return (
    <>
      <span className="block text-body-sm font-semibold">
        {w.label}
        {(w.joined.set || w.left.set) && <Caret />}
        {w.note && <span className="ml-2 font-normal text-ink/70">{w.note}</span>}
      </span>
      <span className="grid grid-cols-2 gap-x-3">
        {([w.joined, w.left] as const).map((r, i) => (
          <span key={i} className="block border-t border-rule py-1.5">
            <RowBody r={r} noData={noData} tone={i === 0 ? "plum" : "ink"} caret={false} />
          </span>
        ))}
      </span>
    </>
  );
}

type FlowWeek = NonNullable<InsightsWords["flow"]>["weeks"][number];

/** A week's row: one fold over its names at full width, joined then left (issue 678), or its bars alone. */
function WeekRow(props: {
  w: FlowWeek;
  i: number;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const { w, t, noData, slug } = props;
  if (!w.joined.set && !w.left.set)
    return (
      <div className="py-1.5">
        <WeekBars w={w} noData={noData} />
      </div>
    );
  return (
    <SetFold
      kind="flow_week"
      setKey={`week-${props.i}`}
      count={(w.joined.set?.people.length ?? 0) + (w.left.set?.people.length ?? 0)}
      title={`${t["insights.flow.weeks"]} · ${w.label}`}
      // Members lists the joiners only: past 60 the fold links there only when nobody left that week, so
      // the link holds exactly what the count counts; otherwise both lists open in the sheet.
      far={w.joined.set && !w.left.set ? membersHref(slug, w.joined.set) : null}
      summary={<WeekBars w={w} noData={noData} />}
      t={t}
    >
      {(
        [
          [w.joined.set, "insights.flow.joinedWho"],
          [w.left.set, "insights.flow.leftWho"],
        ] as const
      ).map(([set, key]) => {
        if (!set) return null;
        // "Joined (1)": a noun and the count, never the bar's "−1" over a name.
        const head = fill(t[key], { n: set.people.length });
        return (
          <div key={key}>
            <h4 className="text-body-sm font-semibold">{head}</h4>
            <Names set={set} slug={slug} label={`${w.label}: ${head}`} />
          </div>
        );
      })}
    </SetFold>
  );
}

/** The weeks, joined then left, each week with a join or a leave linking to its days under its row. */
function Weeks(props: {
  flow: NonNullable<InsightsWords["flow"]>;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const { flow, nav, t, noData, slug } = props;
  return (
    <>
      <TapHint t={t} />
      <ul className="mt-1">
        {flow.weeks.map((w, i) => (
          <li key={w.label} className="border-t border-rule">
            <WeekRow w={w} i={i} t={t} noData={noData} slug={slug} />
            {w.drill && (
              <InsightsDrillLink
                href={levelHref(nav.base, nav.levels, { flow: w.drill.key }, FLOW_CARD)}
                kind="flow_days"
                count={w.drill.count}
                className="tint-button inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline"
              >
                {w.drill.label}
              </InsightsDrillLink>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The window's came-from and went-to bars, under the weeks or a week's days. */
function Places(props: {
  flow: NonNullable<InsightsWords["flow"]>;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { flow, t, noData } = props;
  const joinedAny = flow.came.length > 0;
  const leftAny = flow.went.length > 0;
  return (
    <>
      <Sub>{t["insights.flow.came"]}</Sub>
      {joinedAny ? (
        <Bars rows={flow.came} noData={noData} />
      ) : (
        <p className="text-body-sm">{t["insights.flow.nobodyJoined"]}</p>
      )}
      <Sub>{t["insights.flow.went"]}</Sub>
      {leftAny ? (
        <Bars rows={flow.went} noData={noData} tone="ink" />
      ) : (
        <p className="text-body-sm">{t["insights.flow.nobodyLeft"]}</p>
      )}
      {(joinedAny || leftAny) && (
        <p className="mt-1 text-body-sm text-ink/80">{t["insights.flow.places"]}</p>
      )}
    </>
  );
}

export function FlowCard({
  flow,
  level,
  day,
  nav,
  t,
  noData,
  slug,
}: {
  flow: NonNullable<InsightsWords["flow"]>;
  /** The week the address opens to its days, in the weeks' place; null for the weeks. */
  level: FlowDaysWords | null;
  /**
   * The day the address opens to its came-from and went-to bars, in the weeks' place; the window's own
   * places then give way to it, so the card never shows two "Where newcomers came from".
   */
  day: FlowDayWords | null;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const hrefs = dayHrefs(nav, FLOW_CARD, "flow");
  return (
    <Card id={FLOW_CARD} title={t["insights.flow.head"]} based={[flow.based]}>
      {day ? (
        <FlowDay level={day} {...{ hrefs, t, noData }} />
      ) : (
        <>
          <Sub>{level ? t["drill.flow.days"] : t["insights.flow.weeks"]}</Sub>
          {level ? (
            <FlowDays level={level} hrefs={hrefs} t={t} noData={noData} />
          ) : (
            <Weeks {...{ flow, nav, t, noData, slug }} />
          )}
          <Places {...{ flow, t, noData }} />
        </>
      )}
      <Sub>{t["insights.tenure.head"]}</Sub>
      <p className="text-body-sm text-ink/80">{t["insights.tenure.based"]}</p>
      <Bars rows={flow.tenure} noData={noData} sets={{ slug, t }} />
      <Sub>{t["insights.newcomers.head"]}</Sub>
      {flow.newcomers.map((line) => (
        <p key={line} className="text-body-sm">
          {line}
        </p>
      ))}
    </Card>
  );
}
