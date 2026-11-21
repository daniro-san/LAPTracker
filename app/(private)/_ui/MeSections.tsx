// A member's own page (issue 487, D142): their progress over 30 days (D68: the line in SVG, every label and
// number in HTML beside it), their squads (the member card's lineup, D136) and where they are needed this
// week. Their own data only; no daily quests, coins or donations (CLAUDE.md, D71; D142).
import { en, withEnglish, type Dictionary } from "@/lib/copy";
import { TRANSLATIONS } from "@/lib/i18n";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { MeView } from "@/lib/private/me";
import type { Series } from "@/lib/private/me-parts";

import { LineChart } from "../../_ui/charts/LineChart";
import { MemberSquads } from "./MemberSquads";

type Shown = Extract<MeView, { left: false }>;

const CARD = "drawn-card mt-4 px-4 py-4 first:mt-0";
const HEAD = "font-subhead text-display-sm";

/** The public pages' words for the chart's accessible name (D68's `ledger.chart`). */
const chartCopy = (language: WorkspaceLanguage): Dictionary =>
  language === "en" ? en : withEnglish(TRANSLATIONS[language]);

function Chart(props: { series: Series; language: WorkspaceLanguage; f: ChartFormats }) {
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
  const { might, kills, kvk } = view.progress;
  return (
    <section aria-labelledby="me-progress" className={CARD}>
      <h2 id="me-progress" className={HEAD}>
        {t["me.progress.head"]}
      </h2>
      <p className="mt-1 text-body-sm text-ink/75">{t["me.progress.lead"]}</p>
      {kvk && <p className="mt-2 font-semibold">{kvk}</p>}
      {!might && !kills && <p className="mt-2 text-body-sm">{t["me.progress.early"]}</p>}
      {might && <Chart series={might} language={props.language} f={props.f} />}
      {kills && <Chart series={kills} language={props.language} f={props.f} />}
    </section>
  );
}

export function MeSquads({ view }: { view: Shown }) {
  return (
    <section aria-label={view.squads.head} className={CARD}>
      <MemberSquads squads={view.squads} />
    </section>
  );
}

export function MeNeeded({ view, t }: { view: Shown; t: WorkspaceDictionary }) {
  return view.needed.length === 0 ? (
    <p className="py-2 text-body-sm">{t["me.needed.none"]}</p>
  ) : (
    <ul>
      {view.needed.map((line) => (
        <li key={line} className="border-t border-rule py-2 text-body-sm first:border-t-0">
          {line}
        </li>
      ))}
    </ul>
  );
}
