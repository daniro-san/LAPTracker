// What every Roll call page does first (issue 298): the access check before anything is read (D71), the
// read, the officer's words, and the occasion named in the address (`?entry=&week=` for a Calendar entry's
// week, `?id=` for a roll call added by hand).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { isDay, mondayOf } from "@/lib/private/calendar-time";
import { toReviewCount } from "@/lib/private/import-view";
import type { Occasion } from "@/lib/private/roll-call";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { workspaceWords } from "./Frame";
import { refuse } from "./refuse";

type Search = Record<string, string | string[] | undefined>;

/** The occasion the address names, or null. */
export function occasionOf(search: Search): Occasion | null {
  const one = (k: string) => (typeof search[k] === "string" ? search[k] : "");
  if (/^[1-9]\d{0,8}$/.test(one("id"))) return { id: Number(one("id")) };
  const week = one("week");
  if (/^[1-9]\d{0,8}$/.test(one("entry")) && isDay(week) && mondayOf(week) === week) {
    return { entry: Number(one("entry")), week };
  }
  return null;
}

export async function openRollCall<T>(
  params: Promise<{ slug: string }>,
  /** The page's path below the workspace, for the return after sign-in (D99). */
  path: string,
  read: (db: Db, access: WorkspaceAccess, today: string, language: string) => Promise<T>,
) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const env = getEnv();
  const today = serverDay(now, env);
  const { language, t } = await workspaceWords();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, data, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, data: null, waiting: 0 };
    return {
      access,
      data: await read(db, access, today, language),
      waiting: await toReviewCount(db, access, now),
    };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/${path}`);
    redirect(`/w/${slug}`);
  }
  return { access, data: data as T, waiting, slug, today, now, language, t, zone: env.SERVER_TZ };
}
