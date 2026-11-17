// /w/[slug]: the access check first, then either the sign-in, or the signed-in shell with Home. A session
// older than 24 hours goes through Discord again without a click (prompt=none, D71). Home is a short
// digest of what the other tabs already work out (panel PD-1): today and tomorrow from the Calendar, who to
// thank and how many to check in with from Members, then the screenshots to review and the new members to
// match (D106). Like Members, it first matches new members to the newest roster.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { calendarDays } from "@/lib/private/calendar";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { MAX_PICTURES } from "@/lib/private/import";
import { toReview, type ReviewItem } from "@/lib/private/import-view";
import { cardFormats } from "@/lib/private/member-card";
import { membersView, type MembersView } from "@/lib/private/members";
import { needsAWord, whoOf } from "@/lib/private/members-list";
import { plural } from "@/lib/private/members-sheet";
import { pendingMembers, reconcilePending, toMatch } from "@/lib/private/pending-members";
import { RENEW_MS } from "@/lib/private/session";
import { returnPath, SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { calendarWords, nextItems } from "../../_ui/calendar-data";
import { Frame, SignedInFrame, workspaceWords } from "../../_ui/Frame";
import { digestDays, type NextItem } from "../../_ui/home-digest";
import { HomeNext } from "../../_ui/HomeNext";
import { toMatchLine } from "../../_ui/member-lifecycle-data";
import { nextQuery, refuse } from "../../_ui/refuse";
import { ToReview } from "../../_ui/ToReview";

const ERRORS = ["denied", "discord", "not_configured"] as const;
type SignInError = (typeof ERRORS)[number];

function SignIn({
  slug,
  t,
  error,
  next,
}: {
  slug: string;
  t: WorkspaceDictionary;
  error?: SignInError;
  /** `next=…`: the page asked for before sign-in (D99), or "". */
  next: string;
}) {
  return (
    <section aria-labelledby="sign-in" className="mx-auto max-w-md">
      <h1 id="sign-in" className="font-display text-display-lg">
        {t["signin.title"]}
      </h1>
      <p className="mt-3">{t["signin.lead"]}</p>
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
    <section aria-labelledby="home-next" className="mt-4 border border-rule px-4 py-3">
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

/** Who to thank and how many to check in with, as Members shows them; "not yet" before the first
 * end-of-day read, when nothing is computed (D75). */
function MembersPart(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  view: MembersView;
}) {
  const { slug, t, language, view } = props;
  const members = `/w/${slug}/members`;
  const f = cardFormats(language, getEnv().SERVER_TZ, new Date());
  // The top 3 donors; the most active when no donation was read this week.
  const [key, thanks] =
    view.thanks.donors.length > 0
      ? (["thanks.donors", view.thanks.donors] as const)
      : (["thanks.activity", view.thanks.activity] as const);
  const checkins = view.members.filter((m) => needsAWord(whoOf(m))).length;
  return (
    <section aria-labelledby="home-members" className="mt-4 border border-rule px-4 py-3">
      <h2 id="home-members" className="font-subhead text-display-sm">
        {t["home.members.head"]}
      </h2>
      {view.early ? (
        <p className="mt-1">{t["home.notYet"]}</p>
      ) : (
        <>
          {thanks.length > 0 && (
            <div className="mt-1 max-w-sm">
              <h3 className="text-body-sm font-semibold text-ink/75">{t[key]}</h3>
              <ol>
                {thanks.map((x) => (
                  <li key={x.uid} className="flex justify-between gap-2">
                    <span translate="no" className="min-w-0 truncate font-semibold">
                      {x.name}
                    </span>
                    <span className="tabular-nums">{f.compact(x.value)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {checkins === 0 ? (
            <p className="mt-1">{t["members.checkinNone"]}</p>
          ) : (
            <a href={`${members}?order=rank#ml-heading`} className={LINK}>
              {fill(plural(t, "members.checkinCount", checkins, f), { n: checkins })}
            </a>
          )}
        </>
      )}
      <p>
        <a href={members} className={LINK}>
          {t["home.open"]}
        </a>
      </p>
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
      <h1 id="home" className="font-display text-display-lg">
        {t["home.title"]}
      </h1>
      <NextUp slug={slug} t={t} items={props.next} />
      <MembersPart slug={slug} t={t} language={language} view={props.view} />
      <ToReview
        slug={slug}
        items={props.items}
        t={t}
        language={language}
        maxPictures={MAX_PICTURES}
        toMatch={
          props.toMatch > 0
            ? { line: toMatchLine(props.toMatch, t, f), href: `/w/${slug}/members#to-match` }
            : null
        }
        when={(d) => fill(t["time.server"], { time: at.format(d) })}
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
  const jar = await cookies();
  const now = new Date();
  const zone = getEnv().SERVER_TZ;
  const days = digestDays(serverDay(now, { SERVER_TZ: zone }));
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const {
    access,
    items,
    placed,
    view,
    toMatch: unmatched,
  } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, items: [], placed: [], view: null, toMatch: 0 };
    // D106: a roster read since a new member was added may now list them, as on Members.
    await reconcilePending(db, access, now);
    const [items, placed, view, pending] = await Promise.all([
      toReview(db, access, now),
      calendarDays(db, access, days.from, days.to),
      membersView(db, access, now, zone),
      pendingMembers(db, access),
    ]);
    return { access, items, placed, view, toMatch: toMatch(pending, view.readAt).length };
  });
  const query = await searchParams;
  // The page a refused visitor asked for (refuse.ts), kept through the sign-in.
  const back = returnPath(slug, typeof query.next === "string" ? query.next : null);
  // Only a renewal goes on to `back`: signed out, Home shows the sign-in itself.
  if (!access.ok)
    refuse(slug, access.reason, access.reason === "expired" ? (back ?? undefined) : undefined);
  const { language, t } = await workspaceWords();
  if (!access.ok || !view) {
    const error = ERRORS.find((code) => code === query.e);
    return (
      <Frame language={language} t={t}>
        <SignIn slug={slug} t={t} next={nextQuery(slug, back)} {...(error && { error })} />
      </Frame>
    );
  }
  return (
    <SignedInFrame access={access} language={language} t={t} current="home" waiting={items.length}>
      <Home
        slug={slug}
        t={t}
        language={language}
        items={items}
        next={nextItems(placed, slug, { t, language, zone })}
        view={view}
        toMatch={unmatched}
      />
    </SignedInFrame>
  );
}
