// A member's own page (issue 487, D142): their progress over 30 days (D68: the line in SVG, every label and
// number in HTML beside it), this week against their own last week (the member card's day bars), their
// squads (the member card's lineup, D136) and where they are needed this week. Their own data only.
import { en, withEnglish, type Dictionary } from "@/lib/copy";
import { TRANSLATIONS } from "@/lib/i18n";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { MeView } from "@/lib/private/me";
import type { Series } from "@/lib/private/me-parts";

import { LineChart } from "../../_ui/charts/LineChart";
import { Ended } from "./Ended";
import { MemberLastDays } from "./MemberLastDays";
import { MemberSquads } from "./MemberSquads";
import { NoData } from "./NoData";

type Shown = Extract<MeView, { left: false }>;

const CARD = "drawn-card mt-4 px-4 py-4 first:mt-0";
const HEAD = "font-subhead text-display-sm";

/** The public pages' words for the chart's accessible name (D68's `ledger.chart`). */
const chartCopy = (language: WorkspaceLanguage): Dictionary =>
  language === "en" ? en : withEnglish(TRANSLATIONS[language]);

function Chart(props: {
  id: string;
  series: Series;
  language: WorkspaceLanguage;
  f: ChartFormats;
}) {
  const { series, f } = props;
  return (
    <div className="mt-3">
      <p className="text-body-sm tabular-nums">{series.line}</p>
      <LineChart
        points={series.points.map((p) => ({ at: new Date(`${p.day}T12:00:00Z`), value: p.value }))}
        label={series.label}
        value={f.compact}
        date={f.date}
        time={() => ""}
        small
        copy={chartCopy(props.language)}
        readout={{ id: props.id }}
      />
    </div>
  );
}

interface ChartFormats {
  compact: (n: number) => string;
  date: (d: Date) => string;
}

export function MeProgress(props: {
  view: Shown;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  f: ChartFormats;
}) {
  const { view, t } = props;
  const { might, kills, kvk, thanks } = view.progress;
  return (
    <section aria-labelledby="me-progress" className={CARD}>
      <h2 id="me-progress" className={HEAD}>
        {t["me.progress.head"]}
      </h2>
      {/* D75: thanks first, before the charts. */}
      {thanks && <p className="mt-1">{thanks}</p>}
      <p className="mt-1 text-body-sm text-ink/75">{t["me.progress.lead"]}</p>
      {kvk && <p className="mt-2 font-semibold">{kvk}</p>}
      {!might && !kills && <p className="mt-2 text-body-sm">{t["me.progress.early"]}</p>}
      {might && <Chart id="might" series={might} language={props.language} f={props.f} />}
      {kills && <Chart id="kills" series={kills} language={props.language} f={props.f} />}
    </section>
  );
}

export function MeWeek({ view, t }: { view: Shown; t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="me-week" className={CARD}>
      <h2 id="me-week" className={HEAD}>
        {t["me.week.head"]}
      </h2>
      <p className="mt-1 text-body-sm">{t["me.week.thanks"]}</p>
      <p className="mt-1 text-body-sm text-ink/75">{t["me.week.lead"]}</p>
      {view.week ? (
        <>
          {/* ph-no-capture: session replay records the bars as an empty box, so no bar height reaches
              analytics (the member's daily values are never sent to analytics). */}
          <div className="ph-no-capture">
            <MemberLastDays days={{ ...view.week, head: "" }} />
          </div>
          <ul className="mt-3 text-body-sm text-ink/70">
            <li>
              <span aria-hidden="true">
                <NoData label={view.week.noData} />
              </span>{" "}
              {t["me.week.legend"]}
            </li>
            <li>{t["me.week.legendNone"]}</li>
            <li>{t["me.week.legendZero"]}</li>
          </ul>
        </>
      ) : (
        <p className="mt-2 text-body-sm">{t["me.week.early"]}</p>
      )}
    </section>
  );
}

export function MeSquads({ view }: { view: Shown }) {
  return (
    <section aria-label={view.squads.head} className={CARD}>
      <MemberSquads squads={view.squads} mineFirst />
    </section>
  );
}

/** `since`: when the server rendered the page (epoch ms), for "Ended" until the browser's clock takes over. */
export function MeNeeded({
  view,
  t,
  since,
}: {
  view: Shown;
  t: WorkspaceDictionary;
  since: number;
}) {
  return view.needed.length === 0 ? (
    <p className="py-2 text-body-sm">{t["me.needed.none"]}</p>
  ) : (
    <ul>
      {view.needed.map(({ line, when, step }) => (
        <li key={line} className="border-t border-rule py-2 text-body-sm first:border-t-0">
          {when ? (
            <Ended
              {...when}
              words={{ started: t["calendar.started"], ended: t["calendar.ended"] }}
              since={since}
            >
              {line}
            </Ended>
          ) : (
            line
          )}
          {step && <span className="mt-1 block font-semibold">{step}</span>}
        </li>
      ))}
    </ul>
  );
}
