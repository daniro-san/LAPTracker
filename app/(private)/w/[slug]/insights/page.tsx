// /w/[slug]/insights (issue 489): the officers' analysis of their own alliance, a view of Members. The
// week's pulse, effort at every might level with "Quiet contributors", the membership flow, KvK cost and
// recovery, squads seen and the Raid Shield history, all from data already stored (0 upstream calls). The
// access check runs before anything is read (D71); a page turned off for the alliance goes to Home (D126).
// Nobody is ranked, the only names are a thanks list and a help list (D75, D114), and every section says
// what it rests on.
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { Spread } from "@/lib/brand/components/layout/Spread";
import { getEnv } from "@/lib/env";
import { channelNames } from "@/lib/private/discord-webhooks";
import { thanksSwitches } from "@/lib/private/features";
import { insightsView } from "@/lib/private/insights";
import { kvkWords, shieldWords, squadsWords } from "@/lib/private/insights-more-words";
import { insightsWords } from "@/lib/private/insights-words";

import { SignedInFrame } from "../../../_ui/Frame";
import { KvkCard, ShieldCard, SquadsCard } from "../../../_ui/InsightsMore";
import { EffortCard, FlowCard, PulseCard } from "../../../_ui/InsightsSections";
import { ViewSwitch } from "../../../_ui/MembersHead";
import { openRollCall } from "../../../_ui/roll-call-page";
import { sharePropsFor } from "../../../_ui/share-thanks-data";

export default async function InsightsPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await openRollCall(
    params,
    "insights",
    async (db, access, _today, _language, zone) => {
      const [view, channels] = await Promise.all([
        insightsView(db, access, new Date(), zone),
        channelNames(db, access, getEnv()),
      ]);
      return { view, channel: channels.members };
    },
    "insights",
  );
  const { access, slug, t, language, today, data } = page;
  const words = insightsWords(data.view, t, language);
  const noData = t["nodata.mark"];
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
      {words.pulse && <PulseCard pulse={words.pulse} t={t} noData={noData} />}
      {words.effort && <EffortCard effort={words.effort} t={t} noData={noData} share={share} />}
      {words.flow && <FlowCard flow={words.flow} t={t} noData={noData} />}
      <KvkCard
        kvk={kvkWords(data.view.kvk, data.view.newest, { t, language }, getEnv().DAILY_ROSTER_AT)}
        slug={slug}
        t={t}
        noData={noData}
        followUp={data.view.kvkFollowUp}
      />
      {data.view.squads && (
        <SquadsCard squads={squadsWords(data.view.squads, { t, language })} t={t} noData={noData} />
      )}
      {data.view.shield && (
        <ShieldCard shield={shieldWords(data.view.shield, { t, language })} t={t} noData={noData} />
      )}
    </>
  );
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="insights"
      waiting={page.waiting}
      wide
    >
      <PageHead title={t["members.view.insights"]} />
      <ViewSwitch slug={slug} open="insights" insights t={t} />
      <p className="mt-2 text-body-sm text-ink/80">{t["insights.lead"]}</p>
      <div className="mt-4">
        <Spread
          main={main}
          margin={
            <MarginNote title={t["insights.rules.head"]}>
              {(["read", "none", "left", "private"] as const).map((k) => (
                <p key={k} className="border-t border-rule py-2 text-body-sm first:border-t-0">
                  {t[`insights.rules.${k}`]}
                </p>
              ))}
            </MarginNote>
          }
        />
      </div>
    </SignedInFrame>
  );
}
