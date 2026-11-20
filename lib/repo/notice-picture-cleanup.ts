// The weekly cleanup of notice pictures and its warning (D119, owner 2026-11-18). A picture is due when its
// notice's end day (the newest `ends_on`) is more than PICTURE_KEEP_DAYS before the server day. Home warns
// from WARN_DAYS before that; the weekly job records when the warning began (`warned_at`) and deletes only a
// due picture whose warning is at least WARN_DAYS old and that nobody kept. A notice with no end day is never
// cleaned. Also Keep and "Use in another notice", which copies the bytes so the copy has its own clock.
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { noticePictures, notices } from "../schema-notices";
import { resolveFeatures, picturesShown } from "../workspace-features";
import { putPicture } from "./notice-pictures";
import { live } from "./notices";
import { allSettings } from "./workspace-features";

/** A picture is kept this many days after its notice's end day. */
export const PICTURE_KEEP_DAYS = 90;
/** Home warns this many days before a picture is due, and the cleanup waits as long after the warning. */
export const WARN_DAYS = 7;
const DAY_MS = 24 * 60 * 60_000;

/** `day` (YYYY-MM-DD) moved by `n` days. */
export const shiftDay = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Each notice's newest end day, "" for none. */
const endDays = sql`(
  select distinct on (e.notice_id) e.notice_id, e.value as ends_on
  from notice_edits e
  where e.field = 'ends_on'
  order by e.notice_id, e.id desc
)`;

/** End days on or before this make a picture due within WARN_DAYS of `today`. */
const warnFrom = (today: string) => shiftDay(today, -(PICTURE_KEEP_DAYS - WARN_DAYS + 1));
/** End days on or before this make a picture due on `today`. */
const dueFrom = (today: string) => shiftDay(today, -(PICTURE_KEEP_DAYS + 1));

/**
 * The weekly job, every workspace at once, at `now` (server day `today`). First it deletes the due, unkept
 * pictures warned at least WARN_DAYS ago; then it starts the warning of the unkept pictures due within
 * WARN_DAYS, and ends it for those whose end day moved away or whose notice is in the trash (D118): a
 * deleted notice's picture is neither warned about nor deleted, and a restore brings it back. A save that
 * changes a notice's end day also ends its warning (`writeNotice`). Returns how many pictures were deleted.
 * INVARIANT pictures.warned-first: no picture is deleted unless Home warned about it WARN_DAYS before.
 */
export async function pruneEndedPictures(db: Db, today: string, now: Date): Promise<number> {
  const warnedBy = new Date(now.getTime() - WARN_DAYS * DAY_MS).toISOString();
  // D126: a workspace with notices or their pictures turned off sees no warning, so nothing of it is
  // deleted or warned about; its warnings start again from nothing once both are on.
  const off = (await allSettings(db))
    .filter((w) => !picturesShown(resolveFeatures(w.settings, []).on))
    .map((w) => sql`${w.workspaceId}`);
  const skip = off.length > 0 ? sql`and g.workspace_id not in (${sql.join(off, sql`, `)})` : sql``;
  if (off.length > 0) {
    await db.execute(sql`
      update notice_pictures g set warned_at = null
      where g.warned_at is not null and g.workspace_id in (${sql.join(off, sql`, `)})`);
  }
  const deleted = await db.execute<{ notice_id: number }>(sql`
    delete from notice_pictures g using ${endDays} last, notices n
    where last.notice_id = g.notice_id and n.id = g.notice_id and n.deleted_at is null
      and last.ends_on <> '' and last.ends_on <= ${dueFrom(today)}
      and g.kept_at is null and g.warned_at is not null and g.warned_at <= ${warnedBy} ${skip}
    returning g.notice_id`);
  await db.execute(sql`
    update notice_pictures g set warned_at = ${now.toISOString()} from ${endDays} last, notices n
    where last.notice_id = g.notice_id and n.id = g.notice_id and n.deleted_at is null
      and last.ends_on <> '' and last.ends_on <= ${warnFrom(today)}
      and g.kept_at is null and g.warned_at is null ${skip}`);
  await db.execute(sql`
    update notice_pictures g set warned_at = null
    where g.warned_at is not null and (g.kept_at is not null or not exists (
      select 1 from ${endDays} last join notices n on n.id = last.notice_id
      where last.notice_id = g.notice_id and n.deleted_at is null
        and last.ends_on <> '' and last.ends_on <= ${warnFrom(today)}))`);
  return deleted.rows.length;
}

export interface DuePicture {
  noticeId: number;
  hash: string;
  width: number;
  height: number;
  endsOn: string;
  warnedAt: Date | null;
}

/** The workspace's live notices' pictures that Home warns about on `today`: unkept, due within WARN_DAYS. */
export async function duePictures(
  db: Db,
  workspaceId: number,
  today: string,
): Promise<DuePicture[]> {
  const rows = await db.execute<{
    notice_id: number;
    hash: string;
    width: number;
    height: number;
    ends_on: string;
    warned_at: Date | string | null;
  }>(sql`
    select g.notice_id, g.hash, g.width, g.height, last.ends_on, g.warned_at
    from notice_pictures g
    join ${endDays} last on last.notice_id = g.notice_id
    join notices n on n.id = g.notice_id
    where g.workspace_id = ${workspaceId} and n.deleted_at is null and g.kept_at is null
      and last.ends_on <> '' and last.ends_on <= ${warnFrom(today)}
    order by last.ends_on, g.notice_id`);
  return rows.rows.map((r) => ({
    noticeId: Number(r.notice_id),
    hash: r.hash,
    width: Number(r.width),
    height: Number(r.height),
    endsOn: r.ends_on,
    warnedAt: r.warned_at === null ? null : new Date(r.warned_at),
  }));
}

/**
 * The first server day the cleanup may delete a picture: its due day, and never before WARN_DAYS after its
 * warning began (or after `today`, when the weekly job has not recorded it yet).
 */
export function deletableFrom(
  p: Pick<DuePicture, "endsOn">,
  warnedDay: string | null,
  today: string,
) {
  const due = shiftDay(p.endsOn, PICTURE_KEEP_DAYS + 1);
  const warned = shiftDay(warnedDay ?? today, WARN_DAYS);
  return due > warned ? due : warned;
}

/**
 * Keep (or stop keeping) the notice's picture; null when it has none. `changed` is false when it already was
 * (or was not) kept, so a repeat writes nothing. Keeping ends a warning; un-keeping starts the clock again.
 */
export async function setKept(
  db: Db,
  workspaceId: number,
  noticeId: number,
  kept: { by: number; at: Date } | null,
): Promise<{ changed: boolean } | null> {
  const mine = and(
    eq(noticePictures.workspaceId, workspaceId),
    eq(noticePictures.noticeId, noticeId),
  );
  const done = await db
    .update(noticePictures)
    .set({ keptBy: kept?.by ?? null, keptAt: kept?.at ?? null, warnedAt: null })
    .where(and(mine, kept ? isNull(noticePictures.keptAt) : isNotNull(noticePictures.keptAt)))
    .returning({ id: noticePictures.noticeId });
  if (done.length > 0) return { changed: true };
  const [there] = await db.select({ id: noticePictures.noticeId }).from(noticePictures).where(mine);
  return there ? { changed: false } : null;
}

/** Who kept the notice's picture, and when; null when it is not kept. */
export async function keptBy(db: Db, workspaceId: number, noticeId: number) {
  const [row] = await db
    .select({ by: workspaceUsers.displayName, at: noticePictures.keptAt })
    .from(noticePictures)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticePictures.keptBy))
    .where(
      and(
        eq(noticePictures.workspaceId, workspaceId),
        eq(noticePictures.noticeId, noticeId),
        isNotNull(noticePictures.keptAt),
      ),
    );
  return row?.at ? { by: row.by, at: row.at } : null;
}

/**
 * "Use in another notice": copies `from`'s picture to the live notice `to` of the same workspace, replacing
 * any picture it had. The copy is new: its own added time, not kept, not warned. Null when either is missing.
 */
export async function copyPicture(
  db: Db,
  workspaceId: number,
  from: number,
  to: number,
  userId: number,
  now: Date,
): Promise<{ changed: boolean } | null> {
  const [source] = await db
    .select({
      data: noticePictures.data,
      type: noticePictures.type,
      width: noticePictures.width,
      height: noticePictures.height,
      bytes: noticePictures.bytes,
      hash: noticePictures.hash,
    })
    .from(noticePictures)
    .innerJoin(notices, eq(notices.id, noticePictures.noticeId))
    // A deleted notice's picture (D118) is not copied.
    .where(
      and(eq(noticePictures.workspaceId, workspaceId), eq(noticePictures.noticeId, from), live),
    );
  if (!source || from === to) return null;
  return putPicture(db, workspaceId, to, source, userId, now, from);
}
