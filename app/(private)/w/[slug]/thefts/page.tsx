// /w/[slug]/thefts (issue 321): the thefts log. Secret Operations thefts from our members, grouped by the
// attacker's alliance and by attacker, with this week's and all-time counts and the talks with their
// alliance per attacker. The access check runs before anything is read (D71). It belongs under the
// Calendar tab (issue 300), so that tab is the current one.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { theftsView } from "@/lib/private/thefts";

import { CalendarNav } from "../../../_ui/CalendarNav";
import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { theftCards, theftWords, type TheftFormats } from "../../../_ui/theft-data";
import { TheftsBoard } from "../../../_ui/TheftsBoard";
import { TabSend } from "../../../_ui/ToReview";

/** Server-time dates in the officer's language ("Sun 15 Nov 13:46"), the server day, and "HH:MM". */
function formats(
  language: WorkspaceLanguage,
  zone: string,
): TheftFormats & { hhmm: (at: Date) => string } {
  const date = new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: zone,
  });
  const clock = (locale: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zone,
    });
  const [shown, field] = [clock(language), clock("en-GB")];
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone });
  return {
    when: (at) => `${date.format(at)} ${shown.format(at)}`,
    date: (at) => date.format(at),
    day: (at) => day.format(at),
    hhmm: (at) => field.format(at),
  };
}

export default async function TheftsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const zone = getEnv().SERVER_TZ;
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    const waiting = access.ok ? await toReviewCount(db, access, now) : 0;
    return {
      access,
      waiting,
      view: access.ok ? await theftsView(db, access, { now, zone }) : null,
    };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/thefts`);
    redirect(`/w/${slug}`);
  }
  if (!view) notFound();
  const { language, t } = await workspaceWords();
  const words = theftWords(t);
  const f = formats(language, zone);
  return (
    <SignedInFrame access={access} language={language} t={t} current="days" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["thefts.title"]}</h1>
      {/* The thefts log is a view of the Calendar tab (Week · Caravans · Notices · Thefts, issue 300). */}
      <CalendarNav slug={slug} current="thefts" t={t} />
      <p className="mt-1 text-body-sm text-ink/80">{t["thefts.timesNote"]}</p>
      <p className="mt-2 text-body-sm text-ink/80">{t["thefts.lead"]}</p>
      {/* D110: a Secret Ops report becomes a draft, then thefts on Save. */}
      <TabSend {...{ slug, t, language }} tab="thefts" />
      <TheftsBoard
        slug={slug}
        t={words}
        language={language}
        alliances={theftCards(view.groups, words, f)}
        roster={view.roster}
        start={{ day: f.day(now), time: f.hhmm(now) }}
        serverZone={zone}
      />
    </SignedInFrame>
  );
}
