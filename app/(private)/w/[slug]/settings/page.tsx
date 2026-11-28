// /w/[slug]/settings: Alliance settings (D124, issue 438). The alliance's own tracker key: its state, last 4
// characters and quota left, and Save and test, Replace and Remove, with today's squads read (D132). Then
// Features (D134): what the alliance turns on, of what the site's owner allows, with the tracker calls it
// spends. Then the Raid Shield check's own settings while it is on (D137). Then Notifications, this officer's
// own device, only when the site has push keys (D148). Then Discord (D129): add the bot,
// Check, and the webhooks of the two notice channels and the Raid Shield channel (D147). Then the catalog
// posts the owner allows (D159), then the alliance's own line on our posts while `post_callouts` is on
// (D156), then the Glossary while a translating feature is on (#832). Then the
// alliance's data (D125): "Download our data" and "Delete
// this workspace". Officers only: a member's session goes to the board (refuse.ts). Neither the key nor a
// webhook URL ever reaches the page. Issue 585: the page head says how the page saves, and an "On this page"
// index (`settingsIndex`) lists every card with its state, above the cards on a phone and in the margin
// column from 1024; it shows only what the cards below show.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { PageIndex } from "@/lib/brand/components/layout/PageIndex";
import { Spread } from "@/lib/brand/components/layout/Spread";
import type { Db } from "@/lib/db";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { allianceFeaturesView } from "@/lib/private/alliance-features";
import { agoText } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { botView } from "@/lib/private/discord-setup";
import { webhookViews } from "@/lib/private/discord-webhooks";
import { featureOn } from "@/lib/private/features";
import { glossaryView } from "@/lib/private/glossary";
import { toReviewCount } from "@/lib/private/import-view";
import { headroomView } from "@/lib/private/key-headroom";
import { calloutsView } from "@/lib/private/post-callouts";
import { postsView } from "@/lib/private/post-settings";
import { pushView } from "@/lib/private/push-settings";
import { serverClock } from "@/lib/private/read-status";
import { RENEW_MS } from "@/lib/private/session";
import { shieldSettingsView } from "@/lib/private/shield-settings";
import { SLUG } from "@/lib/private/sign-in";
import { squadsReader, squadsToday, type SquadsToday } from "@/lib/private/squads-today";
import { settingsKeyView } from "@/lib/private/tracker-key";
import { DELETION_GRACE_MS } from "@/lib/private/workspace-deletion";
import { timeChoices } from "@/lib/shield-check";
import { fill } from "@/lib/words";

import { AllianceFeatures } from "../../../_ui/AllianceFeatures";
import { siteBotOff } from "../../../_ui/discord-step";
import { DiscordSection } from "../../../_ui/DiscordSection";
import { deletionDate, SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { GlossaryCard } from "../../../_ui/GlossaryCard";
import { KeyHeadroom } from "../../../_ui/KeyHeadroom";
import { PostCallouts } from "../../../_ui/PostCallouts";
import { PostCatalog } from "../../../_ui/PostCatalog";
import { PushSettings } from "../../../_ui/PushSettings";
import { RaidPrepSettings } from "../../../_ui/RaidPrepSettings";
import { refuse } from "../../../_ui/refuse";
import { settingsIndex, type SettingsIndexInput } from "../../../_ui/settings-index";
import { TrackerKeyForm } from "../../../_ui/TrackerKeyForm";
import { WorkspaceDataForm } from "../../../_ui/WorkspaceDataForm";

/** "Squads today: 98 of 101 read · 3 waiting to try again · next try at 02:15 ST" (D132). */
function squadsLine(
  s: SquadsToday,
  t: Awaited<ReturnType<typeof workspaceWords>>["t"],
  timeZone: string,
): string {
  if (s.stopped) {
    const why = t[`squads.stop.${s.stopped}`];
    if (!s.started) return fill(t["squads.todayStoppedNone"], { why });
    return fill(t["squads.todayStopped"], { read: s.read, members: s.members, why });
  }
  const today = s.started
    ? fill(t["squads.today"], { read: s.read, members: s.members, retrying: s.retrying })
    : t["squads.todayNone"];
  if (!s.nextAt) return today;
  return `${today} · ${fill(t["squads.todayNext"], { at: serverClock(timeZone, s.nextAt) })}`;
}

/**
 * The Raid Shield check's message has a channel (D137, D147): only the Raid Shield channel, never the
 * leaders' (owner's rule of 2026-11-21). One that must be pasted again posts nothing, and the switch says so.
 */
function summaryChannel(channels: Awaited<ReturnType<typeof webhookViews>>) {
  const shield = channels.find((v) => v.channel === "shield")?.state ?? "none";
  if (shield === "reenter") return "reenter";
  return shield === "set" ? "ok" : "none";
}

/** The key card's state, last 4, quota left and "checked …" line, in the officer's words. */
function keyForm(
  view: Awaited<ReturnType<typeof settingsKeyView>>,
  t: Awaited<ReturnType<typeof workspaceWords>>["t"],
  language: WorkspaceLanguage,
  now: Date,
) {
  const checked = view.checkedAt
    ? fill(t["key.checked"], {
        when: agoText(view.checkedAt.toISOString(), now, language, t["calendar.conflict.justNow"]),
      })
    : null;
  const quota =
    view.quotaRemaining === null
      ? null
      : fill(t["key.quota"], { n: new Intl.NumberFormat(language).format(view.quotaRemaining) });
  return { state: view.state, last4: view.last4, quota, checked, siteKey: view.siteKey };
}

/** Everything the page shows, read after requireWorkspace, in parallel. */
async function readSettings(
  db: Db,
  access: WorkspaceAccess,
  ctx: { env: Env; now: Date; language: WorkspaceLanguage; t: WorkspaceDictionary },
) {
  const { env, now } = ctx;
  // The Raid Shield card's settings, read once: the lines' card takes the summary's language from them.
  const shieldRead = shieldSettingsView(db, access, ctx.language);
  // The webhooks, read once: the Posts card names the channels from them.
  const channelsRead = webhookViews(db, access, env);
  // The key's view and the features' estimate, read once: the headroom card counts from both (issue 869).
  const keyRead = settingsKeyView(db, access, env, now);
  const featuresRead = allianceFeaturesView(db, access);
  const [
    view,
    waiting,
    bot,
    channels,
    squads,
    features,
    shield,
    push,
    callouts,
    posts,
    glossary,
    headroom,
  ] = await Promise.all([
    keyRead,
    toReviewCount(db, access, now),
    botView(db, access, env),
    channelsRead,
    squadsReader(db, access, env, now).then((key) =>
      key ? squadsToday(db, access, env, now) : null,
    ),
    featuresRead,
    shieldRead,
    pushView(db, access, env),
    shieldRead.then((s) => calloutsView(db, access, ctx.t, s?.language ?? null)),
    channelsRead.then((c) => postsView(db, access, c, env, ctx.language)),
    glossaryView(db, access),
    Promise.all([keyRead, featuresRead]).then(([v, f]) =>
      headroomView(db, access, v, f.estimate, now),
    ),
  ]);
  return {
    headroom,
    view,
    waiting,
    bot,
    channels,
    squads,
    features,
    shield,
    push,
    callouts,
    posts,
    glossary,
  };
}

/** The first card: the tracker key and today's squads read. */
function TrackerKeyCard(props: {
  slug: string;
  view: ReturnType<typeof keyForm>;
  squads: string | null;
  headroom: Awaited<ReturnType<typeof headroomView>>;
  siteKey: boolean;
  language: WorkspaceLanguage;
  t: Awaited<ReturnType<typeof workspaceWords>>["t"];
}) {
  const { t } = props;
  return (
    <section aria-labelledby="tracker-key" className="drawn-card max-w-2xl px-4 py-3">
      <h2 id="tracker-key" className="font-subhead text-display-sm">
        {t["key.head"]}
      </h2>
      <p className="mt-1">{t["key.lead"]}</p>
      <TrackerKeyForm
        slug={props.slug}
        keyPage={new URL("/account", getEnv().LAP_API_BASE_URL).href}
        view={props.view}
        t={t}
      />
      {props.squads && <p className="mt-3 text-body-sm tabular-nums">{props.squads}</p>}
      {props.headroom && (
        <KeyHeadroom
          headroom={props.headroom}
          siteKey={props.siteKey}
          t={t}
          language={props.language}
        />
      )}
    </section>
  );
}

/** The index's facts, from the same views the cards show (issue 585). */
function indexInput(
  page: Awaited<ReturnType<typeof readSettings>>,
  data: SettingsIndexInput["data"],
): SettingsIndexInput {
  const { view, bot, channels, features, shield, push, callouts, posts, glossary } = page;
  const allowed = features.groups.flatMap((g) => g.features);
  return {
    key: view.state,
    features: allowed.length
      ? { on: allowed.filter((f) => f.on).length, allowed: allowed.length }
      : null,
    shield: shield && { discord: shield.discord, channel: summaryChannel(channels) },
    push: Boolean(push),
    discord: { channels: channels.map((c) => c.state), botOff: siteBotOff(bot) },
    posts: posts && { on: posts.filter((p) => p.on).length, n: posts.length },
    callouts: callouts && {
      set: callouts.filter((c) => c.callout !== "").length,
      n: callouts.length,
    },
    glossary: glossary && glossary.length,
    data,
  };
}

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { env } = getAppContext();
  const { language, t } = await workspaceWords();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, page } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    const ctx = { env, now, language, t };
    return { access, page: access.ok ? await readSettings(db, access, ctx) : null };
  });
  if (!access.ok || !page) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/settings`);
    notFound();
  }
  const data = {
    download: featureOn(access, "export"),
    deletionDate: access.purgeAfter ? deletionDate(access.purgeAfter, language) : null,
  };
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current={null}
      waiting={page.waiting}
      keyShown
      wide
    >
      <PageHead title={t["settings.title"]} meta={t["settings.saveModel"]} />
      <Spread
        marginFirst
        stickyMargin
        marginLabelledBy="settings-index"
        margin={
          <MarginNote id="settings-index" title={t["settings.index"]}>
            <PageIndex
              items={settingsIndex(indexInput(page, data), t)}
              attentionWord={t["settings.index.attention"]}
            />
          </MarginNote>
        }
        main={
          <SettingsCards slug={slug} page={page} data={data} ctx={{ env, now, language }} t={t} />
        }
      />
    </SignedInFrame>
  );
}

/** The cards, in the index's order. */
function SettingsCards(props: {
  slug: string;
  page: Awaited<ReturnType<typeof readSettings>>;
  data: SettingsIndexInput["data"];
  ctx: { env: Env; now: Date; language: WorkspaceLanguage };
  t: Awaited<ReturnType<typeof workspaceWords>>["t"];
}) {
  const { slug, t } = props;
  const { env, now, language } = props.ctx;
  const { view, bot, channels, squads, features, shield, push, callouts, posts, glossary } =
    props.page;
  return (
    <>
      <TrackerKeyCard
        slug={slug}
        view={keyForm(view, t, language, now)}
        squads={squads && squadsLine(squads, t, env.SERVER_TZ)}
        headroom={props.page.headroom}
        siteKey={view.siteKey}
        language={language}
        t={t}
      />
      {features.groups.length > 0 && (
        <AllianceFeatures slug={slug} view={features} language={language} t={t} />
      )}
      {shield && (
        <RaidPrepSettings
          slug={slug}
          view={shield}
          choices={timeChoices(env, now)}
          channel={summaryChannel(channels)}
          t={t}
          language={language}
        />
      )}
      {push && <PushSettings slug={slug} view={push} language={language} t={t} />}
      <DiscordSection
        slug={slug}
        bot={bot}
        channels={channels}
        saving={Boolean(env.WORKSPACE_KEYS_SECRET)}
        t={t}
      />
      {posts && <PostCatalog slug={slug} rows={posts} t={t} language={language} />}
      {callouts && <PostCallouts slug={slug} rows={callouts} t={t} language={language} />}
      {glossary && <GlossaryCard slug={slug} words={glossary} t={t} language={language} />}
      <WorkspaceDataForm
        slug={slug}
        t={t}
        graceDate={deletionDate(new Date(now.getTime() + DELETION_GRACE_MS), language)}
        {...props.data}
      />
    </>
  );
}
