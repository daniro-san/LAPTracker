// /w/[slug]/board, the members' board (D105, issue 331): read-only, for a member's session and for an officer
// looking at what members see. The access check first (requireBoard: never a WorkspaceAccess), then this
// week's member-marked Calendar entries on the viewer's own clock with server time beside them, the notices
// marked for members with their end day, and Start here. Nothing about any person.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { analyticsPerson } from "@/lib/analytics/person";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireBoard, type BoardAccess, type CookieReader } from "@/lib/private/access";
import { boardView } from "@/lib/private/board";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { channelNames } from "@/lib/private/discord-webhooks";
import { featureOn } from "@/lib/private/features";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { AnalyticsPerson } from "../../../_ui/AnalyticsPerson";
import { BoardAccount } from "../../../_ui/BoardAccount";
import { ReachLine } from "../../../_ui/BoardReach";
import { LINK, Notices, StartHere, Week } from "../../../_ui/BoardSections";
import { BoardSectionsSeen } from "../../../_ui/BoardSectionsSeen";
import { BoardThanks } from "../../../_ui/BoardThanks";
import { DeletionNotice, Frame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";

export const metadata: Metadata = { title: "Members’ board" };

/** A strip that stays on screen while scrolling, so a preview is never taken for the member view. */
/**
 * A strip that stays on screen while scrolling, so a preview is never taken for the member view. Edge to
 * edge while the page fills the window; from 1024, where the page is narrower than the window, its edges
 * are the content column's (issue 412 UX pass).
 */
function PreviewStrip({ slug, t }: { slug: string; t: WorkspaceDictionary }) {
  return (
    <aside className="sticky top-0 z-20 -mx-4 -mt-5 mb-4 flex flex-wrap items-center justify-between gap-x-3 bg-plum px-4 py-1 text-paper sm:-mx-6 sm:px-6 lg:mx-0 lg:px-3">
      <p className="py-2 font-semibold">{t["board.preview"]}</p>
      <a
        href={`/w/${slug}`}
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        {t["board.preview.back"]}
      </a>
    </aside>
  );
}

/** The board's visitor to PostHog by a pseudonymous id (D115), when analytics is on. */
function BoardPerson({ env, access }: { env: Env; access: BoardAccess }) {
  const tier = access.officer ? "officer" : "member";
  const person = analyticsPerson(env, {
    userId: access.userId,
    tier,
    slug: access.slug,
    alliance: access.alliance,
  });
  return person && <AnalyticsPerson {...person} />;
}

/**
 * INVARIANT workspace.access-first: nothing private is read before the access check. D126: the board's
 * read only while the board is on, and with notices off it shows none (they stay stored).
 */
function readBoard(slug: string, jar: CookieReader, now: Date, today: string) {
  return withPageDb(async (db) => {
    const access = await requireBoard(db, slug, jar, now);
    if (!access.ok || !featureOn(access, "board")) return { access, view: null, channel: null };
    // D129: the members' channel's name only, the workspace's own or else the site's.
    const [view, channels] = await Promise.all([
      boardView(db, access, today),
      channelNames(db, access, getEnv()),
    ]);
    const channel = channels.members;
    return {
      access,
      view: featureOn(access, "notices") ? view : { ...view, notices: [] },
      channel,
    };
  });
}

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const env = getEnv();
  const today = serverDay(now, env);
  const { access, view, channel } = await readBoard(slug, jar, now, today);
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/board`);
    redirect(`/w/${slug}`);
  }
  // D126: the board turned off for the alliance is not there. An officer goes to Home; a member has
  // nothing else here, so the standard not-found page.
  if (!featureOn(access, "board")) {
    if (access.officer) redirect(`/w/${slug}`);
    notFound();
  }
  const { language, t } = await workspaceWords();
  const { alliance } = access;
  const account = (
    <BoardAccount officer={access.officer} name={access.name ?? ""} slug={slug} t={t} />
  );
  const frame = {
    language,
    t,
    title: t["board.name"],
    account,
    ...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` }),
  };
  if (!view) redirect(`/w/${slug}`);
  const linked = new Set(view.entries.flatMap((e) => (e.noticeId === null ? [] : [e.noticeId])));
  return (
    <Frame {...frame}>
      <BoardPerson env={env} access={access} />
      <BoardSectionsSeen />
      {access.officer && <PreviewStrip slug={slug} t={t} />}
      <DeletionNotice
        slug={slug}
        purgeAfter={access.purgeAfter}
        officer={access.officer}
        t={t}
        language={language}
      />
      <h1 className="font-display text-display-lg">{t["board.title"]}</h1>
      <p className="mt-1">
        {t["board.lead"]}{" "}
        <a href="#board-start" className={LINK}>
          {t["board.lead.start"]}
        </a>
      </p>
      {access.officer && <p className="text-body-sm text-ink/75">{t["board.preview.only"]}</p>}
      <p>
        <a href={`/w/${slug}/board/me`} className={LINK}>
          {t["me.open"]}
        </a>
      </p>
      <BoardThanks
        thanks={view.thanks}
        t={t}
        language={language}
        slug={slug}
        officer={access.officer}
      />
      <Week t={t} language={language} today={today} entries={view.entries} notices={view.notices} />
      <Notices t={t} language={language} notices={view.notices} linked={linked} />
      <StartHere
        t={t}
        language={language}
        texts={view.startHere}
        channel={channel}
        guildId={access.guildId}
        edit={access.officer ? `/w/${slug}/start-here` : null}
      />
      {env.POSTHOG_QUERY_API_KEY && <ReachLine t={t} />}
    </Frame>
  );
}
