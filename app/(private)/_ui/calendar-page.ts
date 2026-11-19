// What both Calendar views do first (issue 300): the access check before anything is read (D71), then the
// week asked for (`?week=`, any day of it; else this server week), the read, and the officer's words.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { isDay, mondayOf, offsetLabel } from "@/lib/private/calendar-time";
import { featureOn } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import type { CalendarCtx } from "./calendar-data";
import { workspaceWords } from "./Frame";
import { refuse } from "./refuse";
import { turnedOffPage } from "./TurnedOff";

/** D126: Caravans turned off for the alliance; then the view reads nothing of its own. */
const turnedOff = (access: WorkspaceAccess, view: string) =>
  view === "calendar/caravans" && !featureOn(access, "caravans");

export async function openCalendar<T>(
  params: Promise<{ slug: string }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  read: (db: Db, access: WorkspaceAccess, monday: string) => Promise<T>,
  /** The view's path below the workspace, for the return after sign-in (D99). */
  view: "calendar" | "calendar/caravans",
) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const env = getEnv();
  const today = serverDay(now, env);
  const asked = (await searchParams).week;
  const monday = mondayOf(typeof asked === "string" && isDay(asked) ? asked : today);
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, data, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, data: null, waiting: 0 };
    const on = !turnedOff(access, view);
    // The Home tab's count of screenshot drafts waiting for review (issue 299), for the frame.
    return {
      access,
      data: on ? await read(db, access, monday) : null,
      waiting: await toReviewCount(db, access, now),
    };
  });
  if (!access.ok) {
    const week = typeof asked === "string" && isDay(asked) ? `?week=${asked}` : "";
    refuse(slug, access.reason, `/w/${slug}/${view}${week}`);
    redirect(`/w/${slug}`);
  }
  const { language, t } = await workspaceWords();
  const ctx: CalendarCtx = { t, language, zone: env.SERVER_TZ };
  return {
    access,
    /** D126: the page to show instead when the view is turned off for the alliance. */
    off: view === "calendar/caravans" ? turnedOffPage(access, "caravans", waiting) : null,
    data: data as T,
    waiting,
    slug,
    monday,
    today,
    thisWeek: mondayOf(today),
    ctx,
    offset: offsetLabel(env.SERVER_TZ, now.getTime()),
  };
}
