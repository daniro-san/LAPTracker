// The Insights page's Usual hours card (issue 873, D163), server-rendered: the server hours most members are
// usually in game around, how many members have enough readings and the one line on the bias show without a
// tap; one row per server hour sits behind "Show the details" (44 px): the hour in ST with the officer's own
// time beside it (after hydration, as the calendar's `Times`), the members whose usual hours include it as a
// count in HTML beside its bar (D68). Counts only, no names: the rows are ph-no-capture.
import { Bar } from "@/app/_ui/charts/Bar";
import { getEnv } from "@/lib/env";
import { zonedInstant } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { InsightsView } from "@/lib/private/insights";
import { usualWords } from "@/lib/private/insights-usual-words";
import { serverDay } from "@/lib/schedule";

import { Card } from "./InsightsBars";
import { Fold } from "./InsightsMore";
import { ZonesCard } from "./InsightsZones";
import { Times } from "./YourTime";

export function UsualCard(props: {
  view: Pick<InsightsView, "usual">;
  now: Date;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { t } = props;
  const zone = getEnv().SERVER_TZ;
  const today = serverDay(props.now, { SERVER_TZ: zone });
  const words = usualWords(props.view.usual, { t, language: props.language });
  const d = words.details;
  return (
    <Card id="insights-usual" title={t["insights.usual.head"]} based={words.based}>
      {d && (
        <Fold summary={t["insights.more"]} className="mt-2">
          <p className="text-body-sm text-ink/80">{d.legend}</p>
          <ul className="ph-no-capture mt-1">
            {d.rows.map((r) => (
              <li key={r.hour} className="border-t border-rule py-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                  <span className="min-w-0">
                    <Times
                      st={r.st}
                      at={zonedInstant(today, r.hour * 60, zone)}
                      day={today}
                      words={t}
                    />
                  </span>
                  <span className="font-semibold tabular-nums text-plum">{r.value}</span>
                </p>
                <Bar axis="row" share={r.share} className="mt-1 h-2 w-full bg-ink/10" />
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </Card>
  );
}

/** The last two cards of Insights: the time zones, then the usual hours. */
export function TimeCards(props: {
  view: Pick<InsightsView, "zones" | "people" | "usual">;
  now: Date;
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  return (
    <>
      <ZonesCard {...props} />
      <UsualCard {...props} />
    </>
  );
}
