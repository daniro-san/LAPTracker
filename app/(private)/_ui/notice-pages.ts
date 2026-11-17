// What the three notice pages share on the server (issue 304): the access check before any read (D71), the
// words made here (dates in the officer's language, times in server time), and the language order.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { refuse } from "./refuse";

/** Checks access first, then reads; a refused visitor goes where `refuse` sends them, else to the sign-in. */
export async function noticePage<T>(
  slug: string,
  read: (db: Db, access: WorkspaceAccess) => Promise<T>,
): Promise<{ access: WorkspaceAccess; data: T }> {
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const page = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, new Date());
    return access.ok ? { access, data: await read(db, access) } : access;
  });
  if ("reason" in page) {
    refuse(slug, page.reason);
    redirect(`/w/${slug}`);
  }
  return page;
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
    name: name ?? t["notices.someone"],
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
    written: (name: string | null, at: Date) => fill(t["notices.written"], by(name, at)),
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
