// The Insights page's Time zones card (owner, 2026-11-22), server-rendered: the largest group and its reset,
// and how many have a time zone, show without a tap; the rows, "Not recorded yet" and the usual-hours line
// sit behind "Show the details" (44 px), as the other cards. Each row: its cities and offset with the count,
// its bar (a share of the members with a time zone, D68: label and number in HTML), and now, the reset and
// KvK on its clock. Counts only; the rows are ph-no-capture (a one-member row is close to per-member).
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { nextKvk, nextReset, type ZoneCounts } from "@/lib/private/insights-zones";
import { zonesWords } from "@/lib/private/insights-zones-words";

import { Fold } from "./InsightsMore";
import { Card } from "./InsightsSections";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export function ZonesCard(props: {
  counts: ZoneCounts;
  /** The page's instant and its server day. */
  now: Date;
  today: string;
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { slug, t } = props;
  const { now, today } = props;
  const env = getEnv();
  const zones = zonesWords(
    props.counts,
    {
      now,
      reset: nextReset(today, env.SERVER_TZ),
      kvk: nextKvk(now, today, env.SERVER_TZ, env.EVENT_WEEKDAY, env.EVENT_TIME),
    },
    { t, language: props.language, serverZone: env.SERVER_TZ, today },
  );
  const add = (
    <a href={`/w/${slug}/members?ask=timeZone`} className={LINK}>
      {t["insights.zones.add"]}
    </a>
  );
  const d = zones.details;
  return (
    <Card id="insights-zones" title={t["insights.zones.head"]} based={zones.based}>
      {d === null ? (
        <p className="text-body-sm">{add}</p>
      ) : (
        <Fold summary={t["insights.more"]} className="mt-2">
          <p className="text-body-sm text-ink/80">{d.legend}</p>
          <ul className="ph-no-capture mt-1">
            {d.rows.map((r) => (
              <li key={r.label} className="border-t border-rule py-1.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                  <span className="min-w-0 font-semibold">{r.label}</span>
                  <span className="tabular-nums">{r.value}</span>
                </p>
                <span aria-hidden="true" className="mt-1 block h-2 w-full bg-ink/10">
                  <span
                    className="block h-2 bg-plum/60"
                    style={{ width: `${Math.round((r.share ?? 0) * 100)}%` }}
                  />
                </span>
                <p className="mt-0.5 text-body-sm text-ink/80 tabular-nums">{r.times}</p>
                {r.change && <p className="text-body-sm text-ink/80">{r.change}</p>}
              </li>
            ))}
            {d.missing && (
              <li className="border-t-2 border-rule py-1.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                  <span className="min-w-0 font-semibold">{t["insights.zones.notRecorded"]}</span>
                  <span className="tabular-nums">{d.missing}</span>
                </p>
                <p className="mt-0.5 text-body-sm text-ink/80">{t["insights.zones.notCounted"]}</p>
                <p className="text-body-sm">{add}</p>
              </li>
            )}
          </ul>
          {d.usual && (
            <div className="border-t-2 border-rule pt-1.5">
              <p className="text-body-sm">{d.usual.line}</p>
              <p className="text-body-sm">
                <a href={`/w/${slug}/members?day=${d.usual.hour}`} className={LINK}>
                  {t["insights.zones.seeWho"]}
                </a>
              </p>
            </div>
          )}
        </Fold>
      )}
    </Card>
  );
}
