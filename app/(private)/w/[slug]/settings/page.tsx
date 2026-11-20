// /w/[slug]/settings: Alliance settings (D124, issue 438). The alliance's own tracker key: its state, last 4
// characters and quota left, and Save and test, Replace and Remove, with today's squads read (D132). Then Discord (D129): add the bot, Check,
// and the two notice channels' webhooks. Then the alliance's data (D125): "Download our data" and "Delete
// this workspace". Officers only: a member's session goes to the board (refuse.ts). Neither the key nor a
// webhook URL ever reaches the page.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { agoText } from "@/lib/private/calendar-words";
import { botView } from "@/lib/private/discord-setup";
import { webhookViews } from "@/lib/private/discord-webhooks";
import { featureOn } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { squadsToday, type SquadsToday } from "@/lib/private/squads-today";
import { trackerKeyView } from "@/lib/private/tracker-key";
import { DELETION_GRACE_MS } from "@/lib/private/workspace-deletion";

import { DiscordSection } from "../../../_ui/DiscordSection";
import { deletionDate, SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { TrackerKeyForm } from "../../../_ui/TrackerKeyForm";
import { WorkspaceDataForm } from "../../../_ui/WorkspaceDataForm";

/** The key states whose squads are read today (D124): the site's key, or a working key of their own. */
const READING = new Set(["site", "ok", "out_of_quota"]);

/** "02:15" on the server's clock. */
const serverClock = (timeZone: string, at: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(at);

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

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { env } = getAppContext();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, waiting, bot, channels, squads } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok)
      return { access, view: null, waiting: 0, bot: null, channels: [], squads: null };
    const [view, waiting, bot, channels, squads] = await Promise.all([
      trackerKeyView(db, access, env, now),
      toReviewCount(db, access, now),
      botView(db, access, env),
      webhookViews(db, access, env),
      featureOn(access, "squads") ? squadsToday(db, access, env, now) : null,
    ]);
    return { access, view, waiting, bot, channels, squads };
  });
  if (!access.ok || !view || !bot) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/settings`);
    notFound();
  }
  const { language, t } = await workspaceWords();
  const checked = view.checkedAt
    ? fill(t["key.checked"], {
        when: agoText(view.checkedAt.toISOString(), now, language, t["calendar.conflict.justNow"]),
      })
    : null;
  return (
    <SignedInFrame access={access} language={language} t={t} current="home" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["settings.title"]}</h1>
      <section aria-labelledby="tracker-key" className="drawn-card mt-4 max-w-2xl px-4 py-3">
        <h2 id="tracker-key" className="font-subhead text-display-sm">
          {t["key.head"]}
        </h2>
        <p className="mt-1">{t["key.lead"]}</p>
        <TrackerKeyForm
          slug={slug}
          keyPage={new URL("/account", getEnv().LAP_API_BASE_URL).href}
          view={{
            state: view.state,
            last4: view.last4,
            quota:
              view.quotaRemaining === null
                ? null
                : fill(t["key.quota"], {
                    n: new Intl.NumberFormat(language).format(view.quotaRemaining),
                  }),
            checked,
          }}
          t={t}
        />
        {squads && READING.has(view.state) && (
          <p className="mt-3 text-body-sm tabular-nums">{squadsLine(squads, t, env.SERVER_TZ)}</p>
        )}
      </section>
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
