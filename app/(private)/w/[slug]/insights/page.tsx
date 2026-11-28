// /w/[slug]/insights (issue 489): the officers' analysis of their own alliance, a view of Members. The
// week's pulse, effort at every might level with "Quiet contributors", the membership flow, KvK cost and
// recovery, the KvK map at the End reading (issue 791), squads seen, the Raid Shield history and the
// members' time zones, all from data already stored (0 upstream calls). The access check runs before anything is read (D71); a page turned
// off for the alliance goes to Home (D126).
// Nobody is ranked: names show in a thanks list, a help list, and behind a tap on a count, the members it
// counts in name order with nothing beside them (D75, D114, issue 678). Every section says what it rests on.
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { Spread } from "@/lib/brand/components/layout/Spread";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { channelNames } from "@/lib/private/discord-webhooks";
import { thanksSwitches } from "@/lib/private/features";
import { insightsView } from "@/lib/private/insights";
import {
  flowDaysWords,
  flowDayWords,
  levelsOf,
  pulseDaysWords,
  pulseDayWords,
  type InsightsLevels,
} from "@/lib/private/insights-days-words";
import {
  kvkLevelWords,
  kvkWords,
  shieldWords,
  squadsWords,
} from "@/lib/private/insights-more-words";
import { insightsWords } from "@/lib/private/insights-words";
import { kvkMapView } from "@/lib/private/kvk-map";

import { SignedInFrame } from "../../../_ui/Frame";
import { EffortCard } from "../../../_ui/InsightsEffort";
import { KvkMapCard } from "../../../_ui/InsightsKvkMap";
import { KvkCard, ShieldCard, SquadsCard } from "../../../_ui/InsightsMore";
import { FlowCard, PulseCard } from "../../../_ui/InsightsSections";
import { InsightsSetMemory } from "../../../_ui/InsightsSetMemory";
import { ZonesCard } from "../../../_ui/InsightsZones";
import { ViewSwitch } from "../../../_ui/MembersHead";
import { openRollCall } from "../../../_ui/roll-call-page";
import { PANE_ID } from "../../../_ui/SetSheet";
import { sharePropsFor } from "../../../_ui/share-thanks-data";

/** The margin: the side pane a set of 13 to 60 opens in from 1024 px (SetSheet, D158), then the rules. */
function Margin({ t }: { t: WorkspaceDictionary }) {
  return (
    <>
      <div id={PANE_ID} className="lg:sticky lg:top-2 lg:mb-6 lg:empty:hidden" />
      <MarginNote title={t["insights.rules.head"]}>
        {(["read", "none", "left", "private"] as const).map((k) => (
          <p key={k} className="border-t border-rule py-2 text-body-sm first:border-t-0">
            {t[`insights.rules.${k}`]}
          </p>
        ))}
      </MarginNote>
    </>
  );
}

/** The page's read, after the access check (D71): the view, with the levels the address asks for. */
const openInsights = (params: Promise<{ slug: string }>, levels: InsightsLevels) =>
  openRollCall(
    params,
    "insights",
    async (db, access, _today, _language, zone) => {
      const now = new Date();
      const [view, channels, map] = await Promise.all([
        insightsView(db, access, now, zone, {
          pulseWeek: levels.pulse,
          pulseDay: levels.pulseDay,
          flowDay: levels.flowDay,
        }),
        channelNames(db, access, getEnv()),
        kvkMapView(db, access, now, zone),
      ]);
      return { view, channel: channels.members, now, map };
    },
    "insights",
  );

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /** A chart's next level (D158 rule 7): a week or a day of the pulse or the flow, a KvK and its day. */
  searchParams: Promise<Partial<Record<keyof InsightsLevels, string | string[]>>>;
}) {
  const levels = levelsOf(await searchParams);
  const { access, slug, t, language, today, data, waiting } = await openInsights(params, levels);
  const f = { t, language };
  const words = insightsWords(data.view, t, language);
  const noData = t["nodata.mark"];
  const nav = { base: `/w/${slug}/insights`, levels };
  const quiet = words.effort?.quiet ?? [];
  const share = sharePropsFor({
    slug,
    t,
    language,
    today,
    switches: { ...thanksSwitches(access), channel: data.channel },
    people: quiet.map((q) => ({ ...q, did: ["steady"], line: t["insights.quiet.deed"] })),
    roster: data.view.roster,
  });
  // The sheet's help names this list, not the week's growth list (D114's words stay on Members and Home).
  share.words["share.pick.help"] = t["insights.quiet.pickHelp"];
  const main = !data.view.newest ? (
    <p className="mt-2">{t["insights.early"]}</p>
  ) : (
    <>
      {words.pulse && (
        <PulseCard
          pulse={words.pulse}
          level={pulseDaysWords(data.view, f)}
          day={pulseDayWords(data.view, f)}
          {...{ nav, t, noData, slug }}
        />
      )}
      <InsightsSetMemory />
      {words.effort && <EffortCard effort={words.effort} {...{ t, noData, share, slug }} />}
      {words.flow && (
        <FlowCard
          flow={words.flow}
          level={flowDaysWords(data.view, levels.flow, f)}
          day={flowDayWords(data.view, f)}
          {...{ nav, t, noData, slug }}
        />
      )}
      <KvkCard
        kvk={kvkWords(data.view.kvk, data.view.newest, f, getEnv().DAILY_ROSTER_AT)}
        level={kvkLevelWords(data.view.kvk, data.view.newest, levels, f)}
        followUp={data.view.kvkFollowUp}
        {...{ slug, t, noData, nav }}
      />
      <KvkMapCard map={data.map} {...{ slug, t, language }} />
      {data.view.squads && (
        <SquadsCard squads={squadsWords(data.view.squads, { t, language })} t={t} noData={noData} />
      )}
      {data.view.shield && (
        <ShieldCard shield={shieldWords(data.view.shield, { t, language })} t={t} noData={noData} />
      )}
      <ZonesCard view={data.view} now={data.now} {...{ slug, t, language }} />
    </>
  );
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="insights"
      waiting={waiting}
      wide
    >
      <PageHead title={t["members.view.insights"]} />
      <ViewSwitch slug={slug} open="insights" insights t={t} />
      <p className="mt-2 text-body-sm text-ink/80">{t["insights.lead"]}</p>
      <div className="mt-4">
        <Spread main={main} margin={<Margin t={t} />} />
      </div>
    </SignedInFrame>
  );
}
