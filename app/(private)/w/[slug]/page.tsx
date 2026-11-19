// /w/[slug]: the access check first, then either the sign-in, or the signed-in shell with Home. A session
// older than 24 hours goes through Discord again without a click (prompt=none, D71). Home is a short
// digest of what the other tabs already work out (panel PD-1): today and tomorrow from the Calendar, who to
// thank and how many to check in with from Members, then the screenshots to review and the new members to
// match (D106), and the notice reviews asked of this officer (D113). Like Members, it first matches new
// members to the newest roster. D124: a card asks for the alliance's own tracker key, or says why it is
// paused. D122: from 1024 the ledger spread, the cards to act on in the main column and the notes to read
// beside them (recent activity with who is on the desk now, then members this week) in the margin column.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { Spread } from "@/lib/brand/components/layout/Spread";
import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { calendarDays } from "@/lib/private/calendar";
import {
  ACTIVITY_FIRST,
  activityPage,
  onDeskNow,
  type ActivityPage,
} from "@/lib/private/desk-activity";
import { activityView } from "@/lib/private/desk-activity-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { toReview, type ReviewItem } from "@/lib/private/import-view";
import { cardFormats } from "@/lib/private/member-card";
import { membersView, progressHistory, type MembersView } from "@/lib/private/members";
import { picturesDue, type DueItem } from "@/lib/private/notice-picture-due";
import { reviewsForMe } from "@/lib/private/notice-reviews";
import { matchOnRead, toMatch } from "@/lib/private/pending-members";
import { RENEW_MS } from "@/lib/private/session";
import { returnPath, SLUG } from "@/lib/private/sign-in";
import { thanksNudge } from "@/lib/private/thanks";
import { trackerKeyView, type KeyState } from "@/lib/private/tracker-key";
import { serverDay } from "@/lib/schedule";

import { calendarWords, nextItems } from "../../_ui/calendar-data";
import { OnDesk, RecentActivity } from "../../_ui/DeskActivity";
import { Frame, SignedInFrame, workspaceWords } from "../../_ui/Frame";
import { digestDays, type NextItem } from "../../_ui/home-digest";
import { HomeMembers } from "../../_ui/HomeMembers";
import { HomeNext } from "../../_ui/HomeNext";
import { toMatchLine } from "../../_ui/member-lifecycle-data";
import { PicturesDueCard } from "../../_ui/PicturesDue";
import { nextQuery, refuse } from "../../_ui/refuse";
import { sharedLines } from "../../_ui/share-lines";
import { ToReview } from "../../_ui/ToReview";

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

/** D124: no key of the alliance's own (or the site's key meanwhile), or a key the tracker paused. */
function KeyCard({ slug, t, state }: { slug: string; t: WorkspaceDictionary; state: KeyState }) {
  if (state === "off" || state === "ok") return null;
  const fix = state === "invalid" || state === "out_of_quota" || state === "reenter";
  return (
    <section aria-labelledby="home-key" className="drawn-card mt-4 px-4 py-3 first:mt-0">
      <h2 id="home-key" className="font-subhead text-display-sm">
        {t[fix ? "key.card.fix" : "key.card.add"]}
      </h2>
      <p className="mt-1">{t[`key.card.${state}`]}</p>
      <a href={`/w/${slug}/settings`} className={LINK}>
        {t["settings.link"]}
      </a>
    </section>
  );
}

function Home(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  items: ReviewItem[];
  next: NextItem[];
  view: MembersView;
  /** New members a roster read since their add could not match (D106, 2026-11-17). */
  toMatch: number;
  /** D108: the other officers on the desk now, and what officers did lately; D119: the notice pictures
   * the weekly cleanup deletes soon; D124: the alliance's own tracker key. */
  desk: { names: string[]; activity: ActivityPage; now: Date; due: DueItem[]; key: KeyState };
  shared: string[] | null;
  reviews: Awaited<ReturnType<typeof reviewsForMe>>;
  /** Sunday or Monday, and the week's thanks not shared yet (D114). */
  nudge: boolean;
}) {
  const { slug, t, language } = props;
  const f = cardFormats(language, getEnv().SERVER_TZ, new Date());
  const at = new Intl.DateTimeFormat(language, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: getEnv().SERVER_TZ,
  });
  return (
    <section aria-labelledby="home">
      <PageHead id="home" title={t["home.title"]} />
      {/* What became of a share from the phone (D110): first, where the person lands. */}
      {props.shared && (
        <div role="status" className="mb-4 border-l-4 border-plum pl-3">
          {props.shared.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      <Spread
        even
        stickyMargin
        main={
          <>
            <KeyCard slug={slug} t={t} state={props.desk.key} />
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
              when={(d) => fill(t["time.server"], { time: at.format(d) })}
            />
          </>
        }
        margin={
          <>
            <RecentActivity
              slug={slug}
              first={activityView(props.desk.activity, t, language, props.desk.now)}
              t={t}
              lead={<OnDesk names={props.desk.names} t={t} language={language} />}
            />
            <HomeMembers
              slug={slug}
              t={t}
              language={language}
              view={props.view}
              nudge={props.nudge}
            />
          </>
        }
      />
    </section>
  );
}

/** Home's two notes after its digest: D119's pictures due for the cleanup, and D124's tracker key. D126:
 * no pictures due while notices or their pictures are turned off for the alliance. */
const cards = (db: Db, access: WorkspaceAccess, now: Date, zone: string) =>
  Promise.all([
    featureOn(access, "notices") && featureOn(access, "notice_pictures")
      ? picturesDue(db, access, now, { SERVER_TZ: zone })
      : [],
    trackerKeyView(db, access, getEnv(), now).then((v) => v.state),
  ]);

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const now = new Date();
  const zone = getEnv().SERVER_TZ;
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
    const [items, placed, view, names, activity, reviews, [due, key]] = await Promise.all([
      toReview(db, access, now),
      calendarDays(db, access, days.from, days.to),
      progressHistory(db, access).then((history) => membersView(db, access, now, zone, history)),
      onDeskNow(db, access, now),
      activityPage(db, access, { now, zone }, null, ACTIVITY_FIRST),
      featureOn(access, "notices") ? reviewsForMe(db, access) : [],
      cards(db, access, now, zone),
    ]);
    const desk = { names, activity, now, due, key };
    const nudge = await thanksNudge(db, access, today);
    const unmatched = toMatch(pending, view.readAt).length;
    return { access, items, placed, view, toMatch: unmatched, desk, reviews, nudge };
  });
  const query = await searchParams;
  // The page a refused visitor asked for (refuse.ts), kept through the sign-in.
  // After a share that was not kept, the sign-in comes back to say so (D110).
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
  // The Home tab's number: drafts and the notice reviews waiting for this officer (D113).
  const waiting = items.length + reviews.length;
  return (
    <SignedInFrame access={access} language={language} t={t} current="home" waiting={waiting} wide>
      <Home
        slug={slug}
        t={t}
        language={language}
        items={items}
        next={nextItems(placed, slug, { t, language, zone })}
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
