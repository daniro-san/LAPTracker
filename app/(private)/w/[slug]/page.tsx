// /w/[slug]: the access check first, then either the sign-in, or the signed-in shell with Home. A session
// older than 24 hours goes through Discord again without a click (prompt=none, D71). Home is a short
// digest of what the other tabs already work out (panel PD-1): today and tomorrow from the Calendar, who to
// thank and how many to check in with from Members, then the screenshots to review and the new members to
// match (D106), and the notice reviews asked of this officer (D113). Like Members, it first matches new
// members to the newest roster. D124: a card asks for the alliance's own tracker key, or says why it is
// paused. D122: from 1024 the ledger spread, the cards to act on in the main column and the notes to read
// beside them (recent activity with who is on the desk now, then members this week) in the margin column.
// Issue 585 slice 4: the main column opens with Follow-up's two numbers and "1 waiting in To review ↓", and
// "Send screenshots" is a card of its own after "To review".
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { Spread } from "@/lib/brand/components/layout/Spread";
import { dateWords } from "@/lib/date-words";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { calendarDays } from "@/lib/private/calendar";
import { ACTIVITY_FIRST, activityPage, onDeskNow } from "@/lib/private/desk-activity";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { homeBadge, toReview, type ReviewItem } from "@/lib/private/import-view";
import { cardFormats } from "@/lib/private/member-card";
import { membersWithProgress, type MembersView } from "@/lib/private/members";
import { reviewsForMe } from "@/lib/private/notice-reviews";
import { matchOnRead, toMatch } from "@/lib/private/pending-members";
import { RENEW_MS } from "@/lib/private/session";
import { returnPath, SLUG } from "@/lib/private/sign-in";
import { thanksNudge } from "@/lib/private/thanks";
import { serverDay } from "@/lib/schedule";
import { fill } from "@/lib/words";

import { calendarWords, nextItems } from "../../_ui/calendar-data";
import { Frame, SignedInFrame, workspaceWords } from "../../_ui/Frame";
import { GrandfatherNotice } from "../../_ui/GrandfatherNotice";
import { cards } from "../../_ui/home-cards";
import { digestDays, type NextItem } from "../../_ui/home-digest";
import { HomeMargin, type HomeDesk } from "../../_ui/HomeMargin";
import { HomeFollowUp } from "../../_ui/HomeMembers";
import { HomeNext } from "../../_ui/HomeNext";
import { KeyCard } from "../../_ui/KeyCard";
import { toMatchLine } from "../../_ui/member-lifecycle-data";
import { NotificationsHint } from "../../_ui/NotificationsHint";
import { PicturesDueCard } from "../../_ui/PicturesDue";
import { nextQuery, refuse } from "../../_ui/refuse";
import { sharedLines } from "../../_ui/share-lines";
import { ReviewJump, SendCard, ToReview } from "../../_ui/ToReview";

const ERRORS = ["denied", "discord", "not_configured"] as const;
/** What Home reads when the visitor is not signed in: nothing. */
const NONE = {
  items: [],
  placed: [],
  view: null,
  toMatch: 0,
  desk: null,
  reviews: [],
  nudge: false,
};
type SignInError = (typeof ERRORS)[number];

function SignIn({
  slug,
  t,
  error,
  next,
  notice,
}: {
  slug: string;
  t: WorkspaceDictionary;
  error?: SignInError;
  /** `next=…`: the page asked for before sign-in (D99), or "". */
  next: string;
  /** "The shared screenshots were not kept…" after a share from the phone (D110). */
  notice: string[] | null;
}) {
  return (
    <section aria-labelledby="sign-in" className="mx-auto max-w-md">
      <h1 id="sign-in" className="font-display text-display-lg">
        {t["signin.title"]}
      </h1>
      <p className="mt-3">{t["signin.lead"]}</p>
      {notice?.map((line) => (
        <p key={line} role="status" className="mt-4 border-l-4 border-plum pl-3">
          {line}
        </p>
      ))}
      {error && (
        <p role="alert" className="mt-4 border-l-4 border-seal pl-3 text-body-sm">
          {t[`signin.e.${error}`]}
        </p>
      )}
      <a
        href={`/api/w/${slug}/login${next && `?${next}`}`}
        className={buttonClass("primary", "mt-6 w-full text-lg")}
      >
        {t["signin.button"]}
      </a>
      <p className="mt-4 text-body-sm text-ink/75">{t["signin.note"]}</p>
      <p className="mt-2">
        <a
          href={`/w/${slug}/how-to`}
          className="inline-flex min-h-11 items-center py-2 font-semibold underline underline-offset-4"
        >
          {t["signin.howto"]}
        </a>
      </p>
    </section>
  );
}

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** Today and tomorrow from the Calendar, on the officer's own clock once the browser knows it. */
function NextUp({ slug, t, items }: { slug: string; t: WorkspaceDictionary; items: NextItem[] }) {
  return (
    <section aria-labelledby="home-next" className="drawn-card mt-4 px-4 py-3 first:mt-0">
      <h2 id="home-next" className="font-subhead text-display-sm">
        {t["home.next.head"]}
      </h2>
      <HomeNext
        items={items}
        serverZone={getEnv().SERVER_TZ}
        renderedAt={Date.now()}
        words={calendarWords(t)}
        heads={{ today: t["home.today"], tomorrow: t["home.tomorrow"], none: t["home.next.none"] }}
      />
      <a href={`/w/${slug}/calendar`} className={LINK}>
        {t["home.calendar"]}
      </a>
    </section>
  );
}

/** Issue 782: "New: <title>" while this officer has not opened What's new since its newest note; no badge. */
function WhatsNewLine({
  slug,
  t,
  title,
}: {
  slug: string;
  t: WorkspaceDictionary;
  title: string | null;
}) {
  if (!title) return null;
  return (
    <p className="mb-4">
      <a href={`/w/${slug}/whats-new`} className={LINK}>
        {fill(t["home.whatsNew"], { title })}
      </a>
    </p>
  );
}

/** "Mon, Nov 16, 18:54 ST", for each item to review. */
function serverWhen(t: WorkspaceDictionary, language: WorkspaceLanguage) {
  const words = dateWords(language, getEnv().SERVER_TZ);
  return (d: Date) => fill(t["time.server"], { time: words.at(d) });
}

function Home(props: {
  /** The workspace; its switches decide what the thanks sheet offers (D126). */
  access: WorkspaceAccess;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  items: ReviewItem[];
  next: NextItem[];
  view: MembersView;
  /** New members a roster read since their add could not match (D106, 2026-11-17). */
  toMatch: number;
  desk: HomeDesk;
  shared: string[] | null;
  reviews: Awaited<ReturnType<typeof reviewsForMe>>;
  /** Sunday or Monday, and the week's thanks not shared yet (D114). */
  nudge: boolean;
  /** The Home tab's number, also said by the jump and the "To review" heading. */
  waiting: number;
}) {
  const { t, language } = props;
  const slug = props.access.slug;
  const f = cardFormats(language, getEnv().SERVER_TZ, new Date());
  return (
    <section aria-labelledby="home">
      <PageHead id="home" title={t["home.title"]} meta={<NotificationsHint slug={slug} t={t} />} />
      {/* What became of a share from the phone (D110): first, where the person lands. */}
      {props.shared && (
        <div role="status" className="mb-4 border-l-4 border-plum pl-3">
          {props.shared.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      <GrandfatherNotice
        slug={slug}
        t={t}
        language={language}
        until={props.access.features.grandfatheredUntil}
      />
      <WhatsNewLine slug={slug} t={t} title={props.desk.whatsNew?.[language] ?? null} />
      {/* No sticky margin (issue 720): at 1024 it scrolled inside itself, beside the page's own scrollbar. */}
      <Spread
        even
        main={
          <>
            <KeyCard slug={slug} t={t} state={props.desk.key} />
            <HomeFollowUp slug={slug} t={t} language={language} followUp={props.desk.followUp} />
            <ReviewJump t={t} waiting={props.waiting} />
            <NextUp slug={slug} t={t} items={props.next} />
            <PicturesDueCard slug={slug} t={t} language={language} items={props.desk.due} />
            <ToReview
              slug={slug}
              items={props.items}
              t={t}
              language={language}
              toMatch={
                props.toMatch > 0
                  ? { line: toMatchLine(props.toMatch, t, f), href: `/w/${slug}/members#to-match` }
                  : null
              }
              reviews={props.reviews}
              when={serverWhen(t, language)}
              day={f.date}
              links={props.desk.links}
              reports={props.desk.reports}
              waiting={props.waiting}
            />
            <SendCard slug={slug} t={t} language={language} />
          </>
        }
        margin={<HomeMargin {...props} />}
      />
    </section>
  );
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [now, zone] = [new Date(), getEnv().SERVER_TZ];
  const today = serverDay(now, { SERVER_TZ: zone });
  const days = digestDays(today);
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const {
    access,
    items,
    placed,
    view,
    toMatch: unmatched,
    desk,
    reviews,
    nudge,
  } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, await cookies(), now, RENEW_MS);
    if (!access.ok) return { access, ...NONE };
    // D106: a roster read since a new member was added may now list them, as on Members.
    const pending = await matchOnRead(db, access, now);
    const members = membersWithProgress(db, access, now, zone);
    const [items, placed, view, names, activity, reviews, notes, nudge] = await Promise.all([
      toReview(db, access, now),
      calendarDays(db, access, days.from, days.to),
      members,
      onDeskNow(db, access, now),
      activityPage(db, access, { now, zone }, null, ACTIVITY_FIRST),
      featureOn(access, "notices") ? reviewsForMe(db, access) : [],
      cards(db, access, { now, zone }, members),
      thanksNudge(db, access, today),
    ]);
    const desk = { names, activity, now, ...notes };
    const unmatched = toMatch(pending, view.readAt).length;
    return { access, items, placed, view, toMatch: unmatched, desk, reviews, nudge };
  });
  const query = await searchParams;
  // The page asked for (refuse.ts), kept through the sign-in; after a lost share, it says so (D110).
  const asked = query.shared === "again" ? `/w/${slug}?shared=again` : null;
  const back = returnPath(slug, typeof query.next === "string" ? query.next : asked);
  // Only a renewal goes on to `back`: signed out, Home shows the sign-in itself.
  if (!access.ok)
    refuse(slug, access.reason, access.reason === "expired" ? (back ?? undefined) : undefined);
  const { language, t } = await workspaceWords();
  const shared = sharedLines(t, language, query);
  if (!access.ok || !view || !desk) {
    const error = ERRORS.find((code) => code === query.e);
    return (
      <Frame language={language} t={t}>
        <SignIn
          slug={slug}
          t={t}
          next={nextQuery(slug, back)}
          notice={shared}
          {...(error && { error })}
        />
      </Frame>
    );
  }
  // The Home tab's number: drafts, the notice reviews for this officer (D113), the links to approve (D142),
  // counted once here for the tab, the jump and the "To review" heading.
  const waiting = homeBadge(items.length, reviews.length, desk.links.length);
  const frame = { access, language, t, waiting };
  return (
    <SignedInFrame {...frame} current="home" wide keyShown>
      <Home
        {...frame}
        items={items}
        next={nextItems(placed, slug, { t, language, zone, endRead: getEnv().SNAPSHOT_AFTER })}
        view={view}
        toMatch={unmatched}
        desk={desk}
        shared={shared}
        reviews={reviews}
        nudge={nudge}
      />
    </SignedInFrame>
  );
}
