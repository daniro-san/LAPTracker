// notice_pictures (D119): a notice's one picture. The write replaces it, the remove deletes it, and the reads
// take the workspace id, so a picture is reached only from its own workspace. The bytes are read only when
// they are served or posted; every other read takes the picture's facts alone.
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { noticePictures, notices } from "../schema-notices";
import { live } from "./notices";

export interface PictureFacts {
  noticeId: number;
  type: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
}

export interface PictureWrite extends Omit<PictureFacts, "noticeId"> {
  data: Uint8Array;
}

const facts = {
  noticeId: noticePictures.noticeId,
  type: noticePictures.type,
  width: noticePictures.width,
  height: noticePictures.height,
  bytes: noticePictures.bytes,
  hash: noticePictures.hash,
};

/** Stores or replaces the notice's picture; false when the workspace has no such notice. */
export async function putPicture(
  db: Db,
  workspaceId: number,
  noticeId: number,
  picture: PictureWrite,
  userId: number,
  now: Date,
): Promise<boolean> {
  const [notice] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(eq(notices.workspaceId, workspaceId), eq(notices.id, noticeId), live));
  if (!notice) return false;
  const row = { ...picture, workspaceId, noticeId, addedBy: userId, addedAt: now };
  await db
    .insert(noticePictures)
    .values(row)
    .onConflictDoUpdate({ target: noticePictures.noticeId, set: row });
  return true;
}

/** Removes the notice's picture; false when it had none. */
export async function deletePicture(
  db: Db,
  workspaceId: number,
  noticeId: number,
): Promise<boolean> {
  const gone = await db
    .delete(noticePictures)
    .where(and(eq(noticePictures.workspaceId, workspaceId), eq(noticePictures.noticeId, noticeId)))
    .returning({ id: noticePictures.noticeId });
  return gone.length > 0;
}

/** The facts of these notices' pictures (no bytes), by notice id. */
export async function pictureFacts(
  db: Db,
  workspaceId: number,
  ids: readonly number[],
): Promise<Map<number, PictureFacts>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select(facts)
    .from(noticePictures)
    .where(
      and(eq(noticePictures.workspaceId, workspaceId), inArray(noticePictures.noticeId, [...ids])),
    );
  return new Map(rows.map((r) => [r.noticeId, r]));
}

/** The picture's bytes and type, or null. */
export async function pictureBytes(
  db: Db,
  workspaceId: number,
  noticeId: number,
): Promise<{ data: Uint8Array; type: string } | null> {
  const [row] = await db
    .select({ data: noticePictures.data, type: noticePictures.type })
    .from(noticePictures)
    .where(and(eq(noticePictures.workspaceId, workspaceId), eq(noticePictures.noticeId, noticeId)));
  return row ?? null;
}

/** Whose picture this is: its facts and its workspace's slug, before any access check. A deleted notice's
 * picture (D118) is kept for Undo but is not found here. */
export async function pictureOwner(
  db: Db,
  noticeId: number,
): Promise<(PictureFacts & { workspaceId: number; slug: string }) | null> {
  const [row] = await db
    .select({ ...facts, workspaceId: noticePictures.workspaceId, slug: workspaces.slug })
    .from(noticePictures)
    .innerJoin(workspaces, eq(workspaces.id, noticePictures.workspaceId))
    .innerJoin(notices, eq(notices.id, noticePictures.noticeId))
    .where(and(eq(noticePictures.noticeId, noticeId), live));
  return row ?? null;
}

/** A picture is kept this many days after its notice's end day (D119, owner 2026-11-18). */
export const PICTURE_KEEP_DAYS = 90;

/**
 * The weekly cleanup (D119), every workspace at once: deletes the picture of each notice whose end day (its
 * newest `ends_on`) is more than PICTURE_KEEP_DAYS before `today` (a server day, YYYY-MM-DD). A notice with
 * no end day keeps its picture. The notice and its text stay; a picture can be added again. Returns how
 * many pictures were deleted.
 */
export async function pruneEndedPictures(db: Db, today: string): Promise<number> {
  const day = 24 * 60 * 60_000;
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - PICTURE_KEEP_DAYS * day)
    .toISOString()
    .slice(0, 10);
  const result = await db.execute<{ notice_id: number }>(sql`
    delete from notice_pictures g
    using (
      select distinct on (e.notice_id) e.notice_id, e.value
      from notice_edits e
      where e.field = 'ends_on'
      order by e.notice_id, e.id desc
    ) last
    where last.notice_id = g.notice_id and last.value <> '' and last.value < ${cutoff}
    returning g.notice_id`);
  return result.rows.length;
}
