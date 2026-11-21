// The Insights page's KvK cost and recovery and squads seen cards (issue 489), server-rendered. The page is
// long, so each card shows its one-line summary (and, for KvK, the help list) and keeps the rest behind
// "Show the details" (a native <details>, 44 px). Older KvKs fold to one line each. Bars follow D68: label
// and number in HTML beside every bar; the recovery is a 7-column day grid like the pulse's. Per-member
// names are ph-no-capture (issue 549); the help list is in name order with no number beside a name, and each
// name opens that member's card (`?m=`, D122). Squads are counts only: no lineup.
import type { ReactNode } from "react";

import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { KvkEventWords, KvkWords, SquadsWords } from "@/lib/private/insights-more-words";
import type { BarRow } from "@/lib/private/insights-words";

import { Bars, Card, Sub } from "./InsightsSections";
import { withNoData } from "./NoData";

const SUMMARY =
  "text-button flex min-h-11 cursor-pointer list-none items-center font-semibold text-plum [&::-webkit-details-marker]:hidden";

/** A fold: its summary line, a ▾ that turns when open, and what it hides. */
function Fold(props: { summary: ReactNode; className?: string; children: ReactNode }) {
  return (
    <details className={`group border-t border-rule ${props.className ?? ""}`}>
      <summary className={SUMMARY}>
        <span className="min-w-0">{props.summary}</span>
        <span aria-hidden="true" className="ml-1 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      {props.children}
    </details>
  );
}

/** The share of the loss back on each day after the event, one column a day, the number under the bar. */
function RecoveryDays({ days, noData }: { days: BarRow[]; noData: string }) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {days.map((d) => (
        <li key={d.label} className="min-w-0" aria-label={`${d.label}: ${d.value}`}>
          <span aria-hidden="true" className="block text-[12px] leading-4 text-ink/70">
            {d.label}
          </span>
          <span aria-hidden="true" className="flex h-8 items-end justify-center">
            {d.share !== null && (
              <span
                className="block w-full max-w-6 rounded-t-sm bg-plum/60"
                style={{ height: `${Math.max(6, Math.round(d.share * 100))}%` }}
              />
            )}
          </span>
          <span aria-hidden="true" className="block h-px bg-ink/50" />
          <span aria-hidden="true" className="block truncate text-[12px] leading-5 tabular-nums">
            {withNoData(d.value, noData)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function EventBody({ e, t, noData }: { e: KvkEventWords; t: WorkspaceDictionary; noData: string }) {
  return (
    <>
      {e.based.map((line) => (
        <p key={line} className="text-body-sm text-ink/80">
          {line}
        </p>
      ))}
      <Bars rows={e.might} noData={noData} tone="ink" />
      {e.days.length > 0 && (
        <>
          <Sub>{t["insights.kvk.days"]}</Sub>
          <RecoveryDays days={e.days} noData={noData} />
        </>
      )}
    </>
  );
}

export function KvkCard(props: {
  kvk: KvkWords | null;
  slug: string;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { kvk, slug, t, noData } = props;
  if (!kvk)
    return (
      <Card id="insights-kvk" title={t["insights.kvk.head"]} based={[t["insights.kvk.none"]]} />
    );
  const [newest, ...older] = kvk.events;
  return (
    <Card id="insights-kvk" title={t["insights.kvk.head"]} based={[kvk.headline]}>
      <div className="mt-3 border-t-2 border-rule pt-2">
        <h3 className="font-semibold">{t["insights.kvk.help.head"]}</h3>
        <p className="text-body-sm text-ink/80">{t["insights.kvk.help.lead"]}</p>
        {kvk.help.length > 0 ? (
          <ul className="ph-no-capture mt-1 text-body-sm">
            {kvk.help.map((p) => (
              <li key={p.uid} className="border-t border-rule">
                <a
                  href={`/w/${slug}/members?m=${p.uid}`}
                  className="text-link flex min-h-11 items-center font-semibold"
                >
                  <bdi translate="no">{p.name}</bdi>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body-sm">{t["insights.kvk.help.none"]}</p>
        )}
      </div>
      <Fold summary={t["insights.more"]} className="mt-2">
        {newest && (
          <div className="pb-2">
            <h3 className="font-semibold">{newest.label}</h3>
            <EventBody e={newest} t={t} noData={noData} />
            {kvk.people.length > 0 && (
              <Fold
                summary={fill(t["insights.kvk.people"], { n: kvk.people.length })}
                className="mt-2 text-body-sm"
              >
                <ul className="ph-no-capture">
                  {kvk.people.map((p) => (
                    <li
                      key={p.uid}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-rule py-1.5"
                    >
                      <bdi translate="no" className="min-w-0 font-semibold">
                        {p.name}
                      </bdi>
                      <span className="tabular-nums">{p.line}</span>
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
          </div>
        )}
        {older.map((e) => (
          <Fold key={e.label} summary={e.line} className="text-body-sm">
            <div className="pb-2">
              <EventBody e={e} t={t} noData={noData} />
            </div>
          </Fold>
        ))}
      </Fold>
    </Card>
  );
}

export function SquadsCard({
  squads,
  t,
  noData,
}: {
  squads: SquadsWords;
  t: WorkspaceDictionary;
  noData: string;
}) {
  return (
    <Card id="insights-squads" title={t["insights.squads.head"]} based={[squads.headline]}>
      <Fold summary={t["insights.more"]} className="mt-2">
        <p className="text-body-sm text-ink/80">{squads.based}</p>
        <Sub>{t["insights.squads.counts"]}</Sub>
        <Bars rows={squads.counts.slice(0, -1)} noData={noData} />
        <div className="mt-2 border-t-2 border-rule">
          <Bars rows={squads.counts.slice(-1)} noData={noData} tone="ink" />
        </div>
        <Sub>{t["insights.squads.fresh"]}</Sub>
        <Bars rows={squads.fresh} noData={noData} />
        {squads.power.length > 0 && (
          <>
            <Sub>{t["insights.squads.power"]}</Sub>
            <Bars rows={squads.power} noData={noData} />
          </>
        )}
      </Fold>
    </Card>
  );
}
