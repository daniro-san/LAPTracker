// notice_pictures (D119): a notice's one picture. The write replaces it, the remove deletes it, and the reads
// take the workspace id, so a picture is reached only from its own workspace. The bytes are read only when
// they are served or posted; every other read takes the picture's facts alone.
import { and, eq, inArray } from "drizzle-orm";

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

/**
 * Stores or replaces the notice's picture; null when the workspace has no such live notice. The same bytes
 * again (a retry, or the same file) write nothing, so the picture keeps its clock: `changed` is false.
 */
export async function putPicture(
  db: Db,
  workspaceId: number,
  noticeId: number,
  picture: PictureWrite,
  userId: number,
  now: Date,
  /** "Use in another notice": the notice the bytes came from (D119). */
  copiedFrom: number | null = null,
): Promise<{ changed: boolean } | null> {
  const [notice] = await db
    .select({ id: notices.id, hash: noticePictures.hash })
    .from(notices)
    .leftJoin(noticePictures, eq(noticePictures.noticeId, notices.id))
    .where(and(eq(notices.workspaceId, workspaceId), eq(notices.id, noticeId), live));
  if (!notice) return null;
  if (notice.hash === picture.hash) return { changed: false };
  // A new picture, or a copy, starts its own clock: not kept, not warned (D119).
  const row = {
    ...picture,
    workspaceId,
    noticeId,
    addedBy: userId,
    addedAt: now,
    copiedFrom,
    keptBy: null,
    keptAt: null,
    warnedAt: null,
  };
  await db
    .insert(noticePictures)
    .values(row)
    .onConflictDoUpdate({ target: noticePictures.noticeId, set: row });
  return { changed: true };
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
