// /w/[slug]/insights/debrief (issue 872): Insights → KvK → Debrief, the meeting after a KvK on one screen.
// Officers only, own alliance (D71), under the Insights switch (D126); from data already stored (0 upstream
// calls). Thanks, Roll call, Map, Recovery, Opponent, then the card to download for the leaders' channel.
// People first (D75): names only in the thanks list (members who gained kills) and the roll call's ✓ lists,
// both in name order with no ranking word; the map is counts only. Bars follow D68/D158 (labels and numbers in
// HTML). Names are ph-no-capture. An Origin of Chaos week has no debrief (#806).
import type { ReactNode } from "react";

import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { getEnv } from "@/lib/env";
import { isOn } from "@/lib/flags";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { compact } from "@/lib/private/insights-format";
import { kvkWords } from "@/lib/private/insights-more-words";
import { kvkDebriefView, type KvkDebrief } from "@/lib/private/kvk-debrief";
import { opponentRows, signed, thanksLine } from "@/lib/private/kvk-debrief-card";
import { fill } from "@/lib/words";

import { SignedInFrame } from "../../../../_ui/Frame";
import { Bars, Card, Sub } from "../../../../_ui/InsightsBars";
import { RecoveryDays } from "../../../../_ui/InsightsMore";
import { openRollCall } from "../../../../_ui/roll-call-page";

interface Props {
  d: KvkDebrief;
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}

const ROW = "flex items-baseline justify-between gap-x-3 border-t border-rule py-1.5";
const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

function Line({ children }: { children: ReactNode }) {
  return <p className="text-body-sm text-ink/80">{children}</p>;
}

/** Names in name order, wrapped, with nothing beside them. */
function Names({ names, empty }: { names: string[]; empty: string }) {
  if (names.length === 0) return <p className="text-body-sm text-ink/70">{empty}</p>;
  return (
    <ul className="ph-no-capture flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
      {names.map((n, i) => (
        <li key={i}>
          <bdi translate="no">{n}</bdi>
        </li>
      ))}
    </ul>
  );
}

function Thanks({ d, t, language }: Props) {
  return (
    <Card id="debrief-thanks" title={t["debrief.thanks.head"]} based={[]}>
      <Line>{thanksLine(d, { t, language })}</Line>
      {d.thanks.length > 0 && (
        <ul className="ph-no-capture mt-1 text-body-sm">
          {d.thanks.map((p) => (
            <li key={p.uid} className={ROW}>
              <bdi translate="no" className="min-w-0 truncate font-semibold">
                {p.name}
              </bdi>
              <span className="whitespace-nowrap tabular-nums">{signed(p.gain, language)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 border-t border-rule pt-2 text-body-sm">{t["debrief.thanks.support"]}</p>
    </Card>
  );
}

function RollCall({ d, t }: Props) {
  const kind = t["roll.kind.shield"];
  const r = d.rollCall;
  return (
    <Card id="debrief-roll" title={t["debrief.roll.head"]} based={[]}>
      {r ? (
        <>
          <Line>{fill(t["debrief.roll.lead"], { kind })}</Line>
          <Sub>{`${t["roll.yes.shield"]} (${r.shield.length})`}</Sub>
          <Names names={r.shield} empty={t["debrief.roll.empty"]} />
          <Sub>{`${t["roll.prep.wall"]} (${r.wall.length})`}</Sub>
          <Names names={r.wall} empty={t["debrief.roll.empty"]} />
        </>
      ) : (
        <Line>{fill(t["debrief.roll.none"], { kind })}</Line>
      )}
    </Card>
  );
}

function MapBands({ d, slug, t, language }: Props) {
  const total = (d.bands ?? []).reduce((a, b) => a + b.kills, 0);
  return (
    <Card id="debrief-map" title={t["debrief.map.head"]} based={[]}>
      <Line>{t["debrief.map.lead"]}</Line>
      {d.bands ? (
        <Bars
          rows={d.bands.map((b) => ({
            label: fill(t["debrief.map.row"], {
              band: t[`insights.map.bands.${b.band}`],
              n: b.members,
            }),
            value: compact(b.kills, language),
            share: total > 0 ? b.kills / total : null,
          }))}
          noData={t["nodata.mark"]}
        />
      ) : (
        <p className="mt-1 text-body-sm">
          {t[d.castle ? "insights.map.bands.few" : "insights.map.bands.empty"]}{" "}
          <a href={`/w/${slug}/insights#insights-kvk-map`} className={LINK}>
            {t["insights.map.head"]}
          </a>
        </p>
      )}
    </Card>
  );
}

function Recovery({ d, t, language }: Props) {
  const noData = t["nodata.mark"];
  const e =
    d.recovery &&
    kvkWords(
      { events: [d.recovery], waiting: null, readsFrom: null },
      d.recovery.nowDay,
      { t, language },
      getEnv().DAILY_ROSTER_AT,
    ).events[0];
  return (
    <Card id="debrief-recovery" title={t["debrief.recovery.head"]} based={e ? e.based : []}>
      {e ? (
        <>
          <Bars rows={e.might} noData={noData} tone="ink" />
          {e.days.length > 0 && (
            <>
              <Sub>{t["insights.kvk.days"]}</Sub>
              <RecoveryDays days={e.days} noData={noData} />
            </>
          )}
        </>
      ) : (
        <Line>{t["debrief.recovery.none"]}</Line>
      )}
    </Card>
  );
}

function Opponent({ d, t, language }: Props) {
  const o = d.opponent;
  return (
    <Card id="debrief-opponent" title={t["debrief.opponent.head"]} based={[]}>
      {o ? (
        <>
          <Line>
            {fill(t["debrief.opponent.lead"], {
              server: o.server,
              us: o.us.counted,
              them: o.them.counted,
            })}
          </Line>
          <ul className="mt-1 text-body-sm">
            {opponentRows(o, { t, language }).map((r) => (
              <li key={r.label} className={`${ROW} flex-wrap`}>
                <span>{r.label}</span>
                <span className="tabular-nums">{r.value}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Line>{t["debrief.opponent.none"]}</Line>
      )}
    </Card>
  );
}

function Sections(props: Props) {
  const { d, slug, t, language } = props;
  return (
    <>
      <p className="mt-2 text-body-sm text-ink/80">
        {fill(t["debrief.lead"], { date: calendarDates(language).short(d.day) })}
      </p>
      <Thanks {...props} />
      <RollCall {...props} />
      <MapBands {...props} />
      <Recovery {...props} />
      <Opponent {...props} />
      <Card id="debrief-card" title={t["debrief.card.head"]} based={[t["debrief.card.lead"]]}>
        <a
          href={`/api/w/${slug}/insights/debrief/card`}
          download
          className="tint-button mt-2 inline-flex min-h-11 items-center px-4 font-semibold"
        >
          {t["debrief.card.download"]}
        </a>
      </Card>
    </>
  );
}

export default async function DebriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { access, slug, t, language, data, waiting } = await openRollCall(
    params,
    "insights/debrief",
    async (db, access, _today, _language, zone) =>
      kvkDebriefView(db, access, new Date(), zone, await isOn("kvk-matchup")),
    "insights",
  );
  return (
    <SignedInFrame access={access} language={language} t={t} current="insights" waiting={waiting}>
      <a
        href={`/w/${slug}/insights#insights-kvk`}
        className="text-link inline-flex min-h-11 items-center font-semibold"
      >
        <span aria-hidden="true" className="mr-1">
          ‹
        </span>
        {t["debrief.back"]}
      </a>
      <PageHead title={t["debrief.head"]} />
      {data ? (
        <Sections d={data} slug={slug} t={t} language={language} />
      ) : (
        <p className="mt-2">{t["debrief.none"]}</p>
      )}
    </SignedInFrame>
  );
}
