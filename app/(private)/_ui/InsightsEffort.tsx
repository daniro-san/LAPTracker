// The Insights page's "Effort at every might level" card (issue 489), server-rendered: what it rests on and
// who is left out ("See who", issue 678), the groups' members once in "Who is in each group" before the
// measures (no name beside a median, D75), each measure's groups as HTML bars (D68), and the "Quiet
// contributors" thanks list with "Share the thanks" (D114).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { InsightsWords } from "@/lib/private/insights-words";

import { Bars, Card, Sub } from "./InsightsSections";
import { Caret, Names, SetFold, TapHint } from "./InsightsSets";
import type { ShareThanksProps } from "./share-thanks-data";
import { ShareThanks } from "./ShareThanks";

export function EffortCard(props: {
  effort: NonNullable<InsightsWords["effort"]>;
  t: WorkspaceDictionary;
  noData: string;
  share: ShareThanksProps | null;
  slug: string;
}) {
  const { effort, t, noData, slug } = props;
  // With too few reads the based lines say so: no groups and no names.
  if (!effort.groups[0]?.rows.length)
    return <Card id="insights-effort" title={t["insights.effort.head"]} based={effort.based} />;
  return (
    <Card id="insights-effort" title={t["insights.effort.head"]} based={effort.based}>
      {effort.leftOut.length > 0 && (
        <div className="border-t border-rule">
          <SetFold
            kind="effort_left_out"
            setKey="left-out"
            count={effort.leftOut.reduce((n, k) => n + k.set.people.length, 0)}
            summary={
              <span className="text-body-sm font-semibold text-plum">
                {t["insights.effort.seeWho"]}
                <Caret />
              </span>
            }
          >
            {effort.leftOut.map((k) => (
              <div key={k.label}>
                <h4 className="text-body-sm font-semibold">{k.label}</h4>
                <Names set={k.set} slug={slug} label={k.label} />
              </div>
            ))}
          </SetFold>
        </div>
      )}
      <p className="mt-2 text-body-sm">{t["insights.effort.lead"]}</p>
      {/* The groups' members once, before the measures: no name beside a group's median (issue 678). */}
      <Sub>{t["insights.effort.who"]}</Sub>
      <TapHint t={t} />
      <Bars rows={effort.ranges} noData={noData} slug={slug} />
      {effort.groups.map((g) => (
        <div key={g.label}>
          <Sub>{g.label}</Sub>
          <Bars rows={g.rows} noData={noData} />
        </div>
      ))}
      <div className="mt-4 border-t-2 border-rule pt-2">
        <h3 className="font-semibold">{t["insights.quiet.head"]}</h3>
        <p className="text-body-sm text-ink/80">{t["insights.quiet.lead"]}</p>
        {effort.quiet.length > 0 ? (
          <ul className="mt-1 text-body-sm">
            {effort.quiet.map((q) => (
              <li key={q.uid} className="border-t border-rule py-2">
                <bdi translate="no" className="font-semibold">
                  {q.name}
                </bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body-sm">{t["insights.quiet.none"]}</p>
        )}
        {props.share && effort.quiet.length > 0 && <ShareThanks {...props.share} />}
      </div>
    </Card>
  );
}
