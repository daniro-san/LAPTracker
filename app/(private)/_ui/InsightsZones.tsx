// The Insights page's Time zones card (owner, 2026-11-22), server-rendered: the largest group and its reset,
// and how many have a time zone, show without a tap; the rows, "Not recorded yet" and the usual-hours line
// sit behind "Show the details" (44 px), as the other cards. Each row: its cities and offset with the count,
// its bar (a share of the members with a time zone, D68: label and number in HTML), and now, the reset and
// KvK on its clock; a tap on the row opens its members' names (issue 678). "Not recorded yet" and usual hours
// link to Members' own filters, the rules their counts use. The rows are ph-no-capture.
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { InsightsView } from "@/lib/private/insights";
import { nextKvk, nextReset, NOT_RECORDED, usualAt } from "@/lib/private/insights-zones";
import { zonesWords, type ZoneRow } from "@/lib/private/insights-zones-words";
import { queryString } from "@/lib/private/members-list";

import { Fold } from "./InsightsMore";
import { Card } from "./InsightsSections";
import { Caret, Names, SetFold, TapHint } from "./InsightsSets";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** A row's cities and offset with its count, its bar, and its moments. */
function RowBody({ r }: { r: ZoneRow }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="min-w-0 font-semibold">{r.label}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-plum">{r.value}</span>
          <Caret />
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 block h-2 w-full bg-ink/10">
        <span
          className="block h-2 bg-plum/60"
          style={{ width: `${Math.round((r.share ?? 0) * 100)}%` }}
        />
      </span>
      <span className="mt-0.5 block text-body-sm text-ink/80 tabular-nums">{r.times}</span>
      {r.change && <span className="block text-body-sm text-ink/80">{r.change}</span>}
    </>
  );
}

export function ZonesCard(props: {
  /** The counts, and everyone a row can name. */
  view: Pick<InsightsView, "zones" | "people">;
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
    props.view.zones,
    {
      now,
      reset: nextReset(today, env.SERVER_TZ),
      kvk: nextKvk(now, today, env.SERVER_TZ, env.EVENT_WEEKDAY, env.EVENT_TIME),
    },
    { t, language: props.language, serverZone: env.SERVER_TZ, today, people: props.view.people },
  );
  const add = (
    <a href={`/w/${slug}/members?${queryString(NOT_RECORDED, "rank")}`} className={LINK}>
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
          <TapHint t={t} />
          <ul className="ph-no-capture mt-1">
            {d.rows.map(
              (r) =>
                r.set && (
                  <li key={r.label} className="border-t border-rule">
                    <SetFold kind="zone" setKey={r.set.key} summary={<RowBody r={r} />}>
                      <Names set={r.set} slug={slug} label={`${r.label}: ${r.value}`} />
                    </SetFold>
                  </li>
                ),
            )}
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
                <a
                  href={`/w/${slug}/members?${queryString(usualAt(d.usual.hour), "rank")}`}
                  className={LINK}
                >
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
