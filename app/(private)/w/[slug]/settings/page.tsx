// /w/[slug]/settings: Alliance settings (D124, issue 438). The alliance's own tracker key: its state, last 4
// characters and quota left, and Save and test, Replace and Remove, with today's squads read (D132). Then
// Features (D134): what the alliance turns on, of what the site's owner allows, with the tracker calls it
// spends. Then the Raid Shield check's own settings while it is on (D137). Then Discord (D129): add the bot, Check, and the two notice channels' webhooks. Then the
// alliance's data (D125): "Download our data" and "Delete
// this workspace". Officers only: a member's session goes to the board (refuse.ts). Neither the key nor a
// webhook URL ever reaches the page.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { allianceFeaturesView } from "@/lib/private/alliance-features";
import { agoText } from "@/lib/private/calendar-words";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { botView } from "@/lib/private/discord-setup";
import { webhookViews } from "@/lib/private/discord-webhooks";
import { featureOn } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import { serverClock } from "@/lib/private/read-status";
import { RENEW_MS } from "@/lib/private/session";
import { MORNING_CHOICES, shieldSettingsView } from "@/lib/private/shield-settings";
import { SLUG } from "@/lib/private/sign-in";
import { squadsReader, squadsToday, type SquadsToday } from "@/lib/private/squads-today";
import { trackerKeyView } from "@/lib/private/tracker-key";
import { DELETION_GRACE_MS } from "@/lib/private/workspace-deletion";

import { AllianceFeatures } from "../../../_ui/AllianceFeatures";
import { DiscordSection } from "../../../_ui/DiscordSection";
import { deletionDate, SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { RaidPrepSettings } from "../../../_ui/RaidPrepSettings";
import { refuse } from "../../../_ui/refuse";
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

/** The leaders' channel can take the Raid Shield check's message (D129, D137). */
const canPost = (channels: Awaited<ReturnType<typeof webhookViews>>) =>
  channels.some((c) => c.channel === "leaders" && (c.state === "set" || c.state === "site"));

/** The key card's state, last 4, quota left and "checked …" line, in the officer's words. */
function keyForm(
  view: Awaited<ReturnType<typeof trackerKeyView>>,
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
  return { state: view.state, last4: view.last4, quota, checked };
}

/** Everything the page shows, read after requireWorkspace, in parallel. */
async function readSettings(
  db: Db,
  access: WorkspaceAccess,
  ctx: { env: Env; now: Date; language: WorkspaceLanguage },
) {
  const { env, now } = ctx;
  const [view, waiting, bot, channels, squads, features, shield] = await Promise.all([
    trackerKeyView(db, access, env, now),
    toReviewCount(db, access, now),
    botView(db, access, env),
    webhookViews(db, access, env),
    squadsReader(db, access, env, now).then((key) =>
      key ? squadsToday(db, access, env, now) : null,
    ),
    allianceFeaturesView(db, access),
    shieldSettingsView(db, access, ctx.language),
  ]);
  return { view, waiting, bot, channels, squads, features, shield };
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
    const ctx = { env, now, language };
    return { access, page: access.ok ? await readSettings(db, access, ctx) : null };
  });
  if (!access.ok || !page) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/settings`);
    notFound();
  }
  const { view, waiting, bot, channels, squads, features, shield } = page;
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="home"
      waiting={waiting}
      keyShown
    >
      <h1 className="font-display text-display-lg">{t["settings.title"]}</h1>
      <section aria-labelledby="tracker-key" className="drawn-card mt-4 max-w-2xl px-4 py-3">
        <h2 id="tracker-key" className="font-subhead text-display-sm">
          {t["key.head"]}
        </h2>
        <p className="mt-1">{t["key.lead"]}</p>
        <TrackerKeyForm
          slug={slug}
          keyPage={new URL("/account", getEnv().LAP_API_BASE_URL).href}
          view={keyForm(view, t, language, now)}
          t={t}
        />
        {squads && (
          <p className="mt-3 text-body-sm tabular-nums">{squadsLine(squads, t, env.SERVER_TZ)}</p>
        )}
      </section>
      {features.groups.length > 0 && (
        <AllianceFeatures slug={slug} view={features} language={language} t={t} />
      )}
      {shield && (
        <RaidPrepSettings
          slug={slug}
          view={shield}
          choices={MORNING_CHOICES}
          leaders={canPost(channels)}
          t={t}
        />
      )}
      <DiscordSection
        slug={slug}
        bot={bot}
        channels={channels}
        saving={Boolean(env.WORKSPACE_KEYS_SECRET)}
        t={t}
      />
      <WorkspaceDataForm
        slug={slug}
        t={t}
        graceDate={deletionDate(new Date(now.getTime() + DELETION_GRACE_MS), language)}
        deletionDate={access.purgeAfter ? deletionDate(access.purgeAfter, language) : null}
        download={featureOn(access, "export")}
      />
    </SignedInFrame>
  );
}
