// What the three notice pages share on the server (issue 304): the access check before any read (D71), the
// words made here (dates in the officer's language, times in server time), and the language order.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { fill, isolate } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn, writingOff } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import type { noticeReviews, ReviewView } from "@/lib/private/notice-reviews";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";
import type { ReviewProps } from "./NoticeReviews";
import { refuse } from "./refuse";
import { turnedOffPage } from "./TurnedOff";

/** Checks access first, then reads; a refused visitor goes where `refuse` sends them, else to the sign-in. */
export async function noticePage<T>(
  slug: string,
  read: (db: Db, access: WorkspaceAccess) => Promise<T>,
  /** The page's path below /notices, for the return after sign-in (D99): "", "/new" or "/<id>". */
  sub: string,
): Promise<{ access: WorkspaceAccess; data: T; waiting: number; off: ReactNode }> {
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const page = await withPageDb(async (db) => {
    const now = new Date();
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return access;
    const waiting = await toReviewCount(db, access, now);
    // D126: notices turned off for the alliance: nothing of theirs is read; the page shows `off`.
    const off = turnedOffPage(access, "notices", waiting);
    if (off) return { access, data: null as T, waiting, off };
    // The Home tab's count of screenshot drafts (issue 299), in this page's own read.
    return { access, data: await read(db, access), waiting, off };
  });
  if ("reason" in page) {
    refuse(slug, page.reason, `/w/${slug}/notices${sub}`);
    redirect(`/w/${slug}`);
  }
  return page;
}

/**
 * The editor's switches (D126): the notice's picture and its field only while notice pictures are on (a
 * stored picture stays), and the writing helps turned off for the alliance.
 */
export function editorSwitches<P>(access: WorkspaceAccess, picture: P | null) {
  const pictures = featureOn(access, "notice_pictures");
  return { picture: pictures ? picture : null, pictureOff: !pictures, aiOff: writingOff(access) };
}

/** The flags, "written by" and "last change" lines, made on the server in the officer's language. */
export function noticeWords(language: WorkspaceLanguage, t: WorkspaceDictionary) {
  const zone = getEnv().SERVER_TZ;
  const today = serverDay(new Date(), { SERVER_TZ: zone });
  const short = { weekday: "short", day: "numeric", month: "short" } as const;
  const day = new Intl.DateTimeFormat(language, { ...short, timeZone: "UTC" });
  const date = new Intl.DateTimeFormat(language, { ...short, timeZone: zone });
  const hhmm = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  });
  const when = (at: Date) =>
    fill(t["time.server"], { time: `${date.format(at)} ${hhmm.format(at)}` });
  const by = (name: string | null, at: Date) => ({
    name: name ? isolate(name) : t["notices.someone"],
    when: when(at),
  });
  return {
    flags: (n: { forMembers: boolean; endsOn: string | null }) => [
      t[n.forMembers ? "notices.forMembers" : "notices.leadersOnly"],
      ...(n.endsOn
        ? [
            fill(t[n.endsOn < today ? "notices.ended" : "notices.until"], {
              date: day.format(new Date(`${n.endsOn}T00:00:00Z`)),
            }),
          ]
        : []),
    ],
    /** "Posted to Discord by Rook · Tue, Nov 17 14:02 ST · EN, PT" (D102). */
    posted: (
      p: { by: string | null; at: Date; languages: string[] } | null,
      /** The channel's name for the audience it was posted to, when still set up. */
      channel: string | null,
    ) =>
      p &&
      fill(t["notices.publish.last"], {
        ...by(p.by, p.at),
        where: channel ? `#${channel}` : "Discord",
        languages: p.languages.map((l) => LANGUAGE_CODE[l as NoticeLanguage] ?? l).join(", "),
      }),
    /** "Rook · Tue, Nov 17 14:02 ST": an earlier version's line (D102). */
    version: (name: string | null, at: Date) => fill(t["notices.history.by"], by(name, at)),
    written: (name: string | null, at: Date) => fill(t["notices.written"], by(name, at)),
    /** "Rook" (isolated) or "an officer", and the time in server time. */
    by,
    /** "Tue, Nov 17 19:08": a time where the page says once that times are server time. */
    clock: (at: Date) => `${date.format(at)} ${hhmm.format(at)}`,
    changed: (name: string | null, at: Date) => fill(t["notices.changed"], by(name, at)),
  };
}

/** The officer's language first, then the other two. */
export const languagesFor = (viewer: WorkspaceLanguage): NoticeLanguage[] => [
  viewer,
  ...NOTICE_LANGUAGES.filter((l) => l !== viewer),
];

/** Where "Translate from …" starts: the first written language that is up to date, the officer's first. */
export function sourceFor(
  languages: NoticeLanguage[],
  text: Record<NoticeLanguage, { value: string }>,
  stale: NoticeLanguage[],
): NoticeLanguage | null {
  return languages.find((l) => text[l].value !== "" && !stale.includes(l)) ?? null;
}

/** Review requests (D113): the open ones with who asked, what and for whom; the newest 5 answered. */
export function reviewProps(
  words: ReturnType<typeof noticeWords>,
  t: WorkspaceDictionary,
  reviews: Awaited<ReturnType<typeof noticeReviews>>,
  viewerId: number,
): ReviewProps {
  // The language by its name, or "the whole notice" (persona panel, 2026-11-17).
  const what = (l: NoticeLanguage | null) => (l ? LANGUAGE_NAME[l] : t["notices.review.wholeIn"]);
  const sub = (r: ReviewView) => {
    const { when } = words.by(null, r.askedAt);
    if (r.reviewerId === null) return fill(t["notices.review.forTeam"], { when });
    if (r.reviewerId === viewerId) return fill(t["notices.review.forYou"], { when });
    return fill(t["notices.review.for"], words.by(r.reviewer, r.askedAt));
  };
  return {
    open: reviews.list
      .filter((r) => !r.outcome)
      .map((r) => ({
        id: r.id,
        language: r.language,
        mine: r.mine,
        line: fill(t["notices.review.asked"], {
          name: words.by(r.askedBy, r.askedAt).name,
          what: what(r.language),
        }),
        sub: sub(r),
        approve: fill(t["notices.review.approve"], { what: what(r.language) }),
        edit: fill(t["notices.review.edit"], { what: what(r.language) }),
        jump: r.language && fill(t["notices.review.jump"], { what: what(r.language) }),
      })),
    done: reviews.list
      .flatMap((r) =>
        r.outcome
          ? [
              fill(t[`notices.review.${r.outcome.kind}`], {
                what: what(r.language),
                name: words.by(r.outcome.by, r.outcome.at).name,
                when: words.clock(r.outcome.at),
              }),
            ]
          : [],
      )
      .slice(0, 5),
    officers: reviews.officers.map((o) => ({ id: o.id, name: o.name ?? t["notices.someone"] })),
  };
}
