// The Insights page's KvK cost and recovery, squads seen and Raid Shield history cards (issue 489),
// server-rendered. The page is long, so each card shows its one-line summary (and, for KvK, the help list)
// and keeps the rest behind "Show the details" (a native <details>, 44 px). Older KvKs fold to one line
// each. Bars follow D68: label and number in HTML beside every bar; the recovery is a 7-column day grid like
// the pulse's. Per-member names are ph-no-capture (issue 549); the help list is in name order with no number
// beside a name, and each name opens that member's card (`?m=`, D122). A recovery day opens its numbers in
// the card's place (D158 rule 7 (b), `?kvk=<day>&kvkDay=<day>`), under a path whose middle step is that KvK
// with its days unfolded. Squads and Raid Shields are counts only: no lineup, no names.
import type { ReactNode } from "react";

import { Bar } from "@/app/_ui/charts/Bar";
import { DrillPath } from "@/app/_ui/charts/DrillPath";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { levelHref } from "@/lib/private/insights-days-words";
import type {
  KvkEventWords,
  KvkLevelWords,
  KvkWords,
  ShieldWords,
  SquadsWords,
} from "@/lib/private/insights-more-words";
import type { BarRow } from "@/lib/private/insights-words";
import { fill } from "@/lib/words";

import { Bars, Card, KVK_CARD, Sub, type LevelNav } from "./InsightsBars";
import { DayPicks } from "./InsightsDays";
import { withNoData } from "./NoData";

const SUMMARY =
  "text-button flex min-h-11 cursor-pointer list-none items-center font-semibold text-plum [&::-webkit-details-marker]:hidden";

/** A fold: its summary line, a ▾ that turns when open, and what it hides. */
export function Fold(props: { summary: ReactNode; className?: string; children: ReactNode }) {
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

/**
 * The share of the loss back on each day after the event, one column a day, the number under the bar, and
 * a tick at 100 % across the columns (D158): a day past 100 % draws taller than it, a day that lost more a
 * hairline.
 */
export function RecoveryDays({ days, noData }: { days: BarRow[]; noData: string }) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {days.map((d) => (
        <li key={d.label} className="min-w-0">
          <span className="sr-only">{`${d.label}: ${d.value}`}</span>
          <span aria-hidden="true" className="block text-[12px] leading-4 text-ink/70">
            {d.label}
          </span>
          <span aria-hidden="true" className="flex h-8 items-end justify-center">
            <Bar
              axis="column"
              share={d.share}
              reference={d.reference ?? null}
              tone="rounded-t-sm bg-plum/60"
              className="h-full w-full max-w-6"
            />
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

/** The KvK card's address with its level changed, the other cards' levels kept. */
type KvkHref = (change: { kvk: string | null; kvkDay: string | null }) => string;

function EventBody(props: {
  e: KvkEventWords;
  t: WorkspaceDictionary;
  noData: string;
  href: KvkHref;
}) {
  const { e, t, noData, href } = props;
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
          <DayPicks
            label={t["drill.kvk.pick"]}
            picks={e.picks}
            href={(day) => href({ kvk: e.day, kvkDay: day })}
            kind="kvk_day"
          />
        </>
      )}
    </>
  );
}

/**
 * "Took a heavy hit — maybe offer help": the names, each to their card, and while Follow-up's "After KvK,
 * offer help" has someone in it, a link to that group (issue 585 S5).
 */
function HelpList(props: {
  kvk: KvkWords;
  slug: string;
  t: WorkspaceDictionary;
  followUp: boolean;
}) {
  const { kvk, slug, t } = props;
  return (
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
      {props.followUp && (
        <p className="mt-2 text-body-sm">
          {`${t["insights.kvk.help.followUp"]} `}
          <a
            href={`/w/${slug}/follow-up#follow-up-kvk`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {t["insights.kvk.help.followUpLink"]}
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * The KvK level the address opens, in the card's place: a KvK with its recovery days unfolded, or one of
 * those days' numbers, with the members it counts and the share its column shows.
 */
function KvkLevel(props: {
  level: KvkLevelWords;
  href: KvkHref;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, href, t, noData } = props;
  const top = href({ kvk: null, kvkDay: null });
  const event = href({ kvk: level.event.day, kvkDay: null });
  const head = { label: t["insights.kvk.head"], href: top };
  if (!level.day)
    return (
      <>
        <DrillPath
          name={t["drill.path"]}
          back={{ href: top, label: t["drill.kvk.back"] }}
          steps={[head, { label: level.event.label }]}
          sticky
        />
        <EventBody e={level.event} {...{ t, noData, href }} />
      </>
    );
  return (
    <>
      <DrillPath
        name={t["drill.path"]}
        back={{ href: event, label: level.event.label }}
        steps={[head, { label: level.event.label, href: event }, { label: level.day.label }]}
        sticky
      />
      <p className="text-body-sm text-ink/80">{level.day.counted}</p>
      <Bars rows={level.day.might} noData={noData} tone="ink" />
      <p className="mt-2 border-t border-rule pt-2 text-body-sm font-medium tabular-nums">
        {level.day.sum}
      </p>
    </>
  );
}

export function KvkCard(props: {
  kvk: KvkWords;
  slug: string;
  t: WorkspaceDictionary;
  noData: string;
  /** Follow-up's "After KvK, offer help" has someone in it: the help list links to it (issue 585 S5). */
  followUp: boolean;
  /** The level the address opens, in the card's place; null for the card itself. */
  level: KvkLevelWords | null;
  nav: LevelNav;
}) {
  const { kvk, slug, t, noData, nav, level } = props;
  const href: KvkHref = (change) => levelHref(nav.base, nav.levels, change, KVK_CARD);
  const [newest, ...older] = kvk.events;
  if (!newest) return <Card id={KVK_CARD} title={t["insights.kvk.head"]} based={kvk.based} />;
  if (level)
    return (
      <Card id={KVK_CARD} title={t["insights.kvk.head"]} based={[]}>
        <KvkLevel level={level} {...{ href, t, noData }} />
      </Card>
    );
  return (
    <Card id={KVK_CARD} title={t["insights.kvk.head"]} based={kvk.based}>
      <HelpList kvk={kvk} slug={slug} t={t} followUp={props.followUp} />
      <a
        href={`/w/${slug}/insights/debrief`}
        className="text-link mt-2 flex min-h-11 items-center border-t border-rule font-semibold"
      >
        {t["debrief.link"]}
        <span aria-hidden="true" className="ml-1">
          ›
        </span>
      </a>
      <Fold summary={t["insights.more"]} className="mt-2">
        {newest && (
          <div className="pb-2">
            <h3 className="font-semibold">{newest.label}</h3>
            <EventBody e={newest} {...{ t, noData, href }} />
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
              <EventBody e={e} {...{ t, noData, href }} />
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

/** Raid Shield history: thanks first, counts only, a week with no check is one "no reading" line (D75). */
export function ShieldCard({
  shield,
  t,
  noData,
}: {
  shield: ShieldWords;
  t: WorkspaceDictionary;
  noData: string;
}) {
  return (
    <Card id="insights-shield" title={t["insights.shield.head"]} based={[shield.headline]}>
      <Fold summary={t["insights.more"]} className="mt-2">
        <p className="text-body-sm font-semibold">{t["insights.shield.thanks"]}</p>
        <p className="mt-1 text-body-sm text-ink/80">{t["insights.shield.lead"]}</p>
        <Sub>{t["insights.shield.weeks"]}</Sub>
        <ol>
          {shield.weeks.map((w) => (
            <li key={w.label} className="mt-1 border-t-2 border-rule pt-1.5">
              <h4 className="text-body-sm font-semibold">{w.label}</h4>
              {w.rows.length === 0 ? (
                <p className="pb-1.5 text-body-sm text-ink/70">{t["insights.shield.noReading"]}</p>
              ) : (
                <Bars rows={w.rows} noData={noData} />
              )}
            </li>
          ))}
        </ol>
      </Fold>
    </Card>
  );
}
