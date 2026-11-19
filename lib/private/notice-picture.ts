// A notice's one picture (D119): the server's own check of what the browser sends (never trusted), the save
// and the remove on a WorkspaceAccess, and the one read that serves it, which applies the notice's own access:
// an officer of its workspace, or a member while the members' board shows the notice. Nothing is logged but
// codes and numbers.
import { createHash } from "node:crypto";

import type { Db } from "../db";
import {
  deletePicture,
  pictureBytes,
  pictureOwner,
  putPicture,
  type PictureFacts,
} from "../repo/notice-pictures";
import { isDeleted } from "../repo/trash";
import { notices } from "../schema-notices";
import { isAnimated, pictureSize } from "../screenshot/picture-size";
import { requireBoard, requireWorkspace, type CookieReader, type WorkspaceAccess } from "./access";
import { boardShowsNotice } from "./board";
import {
  MAX_PICTURE_BYTES,
  MAX_PICTURE_SIDE,
  pictureView,
  type PictureType,
  type PictureView,
} from "./notice-picture-rules";

export type PictureRefusal = "empty" | "too_large" | "wrong_type" | "too_big_sides" | "animated";

/** The format the bytes start with (WebP, JPEG or PNG), whatever the request said; null for any other. */
function typeOf(b: Uint8Array): PictureType | null {
  const text = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && text(1, 8) === "PNG\r\n\u001a\n") return "image/png";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** The server's check (D119): magic bytes, at most 400 KB, a size its header states, 1600 px a side, not animated. */
export function checkPicture(
  bytes: Uint8Array,
):
  | { ok: true; type: PictureType; width: number; height: number }
  | { ok: false; code: PictureRefusal } {
  if (bytes.length === 0) return { ok: false, code: "empty" };
  if (bytes.length > MAX_PICTURE_BYTES) return { ok: false, code: "too_large" };
  const type = typeOf(bytes);
  const size = type ? pictureSize(bytes) : null;
  if (!type || !size || size.width < 1 || size.height < 1) return { ok: false, code: "wrong_type" };
  if (Math.max(size.width, size.height) > MAX_PICTURE_SIDE) {
    return { ok: false, code: "too_big_sides" };
  }
  if (isAnimated(bytes)) return { ok: false, code: "animated" };
  return { ok: true, type, ...size };
}

/**
 * Stores or replaces the notice's picture after the check; "not_found" for no such notice, "notice_deleted"
 * for one in the trash (D118), so the editor offers to restore it.
 */
export async function savePicture(
  db: Db,
  access: WorkspaceAccess,
  noticeId: number,
  bytes: Uint8Array,
  now: Date,
): Promise<
  | { ok: true; picture: PictureView; changed: boolean }
  | { ok: false; code: PictureRefusal | "not_found" | "notice_deleted" }
> {
  const checked = checkPicture(bytes);
  if (!checked.ok) return checked;
  const { type, width, height } = checked;
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const facts = { type, width, height, bytes: bytes.length, hash };
  const saved = await putPicture(
    db,
    access.workspaceId,
    noticeId,
    { ...facts, data: bytes },
    access.user.id,
    now,
  );
  if (saved)
    return { ok: true, picture: pictureView({ noticeId, ...facts }), changed: saved.changed };
  const trashed = await isDeleted(db, notices, access.workspaceId, noticeId);
  return { ok: false, code: trashed ? "notice_deleted" : "not_found" };
}

/**
 * Removes the notice's picture: "removed", "none" when it had none, "notice_deleted" for a notice in the
 * trash (D118), whose picture stays.
 */
export async function removePicture(db: Db, access: WorkspaceAccess, noticeId: number) {
  if (await isDeleted(db, notices, access.workspaceId, noticeId)) return "notice_deleted";
  return (await deletePicture(db, access.workspaceId, noticeId)) ? "removed" : "none";
}

/**
 * GET /img/notice/[id]: the picture's facts when this browser's session may see the notice, else null (the
 * route answers 404, so a refusal and a missing picture look the same). An officer's session of the
 * notice's workspace; a member's only while the board shows the notice on `today` (a server day). A session
 * of another workspace is refused by the doors themselves (workspace.session-bound). `officer`: the officer's
 * access, for Download (D119); null for a member.
 */
export async function servablePicture(
  db: Db,
  noticeId: number,
  cookies: CookieReader,
  now: Date,
  today: string,
): Promise<(PictureFacts & { workspaceId: number; officer: WorkspaceAccess | null }) | null> {
  const owner = await pictureOwner(db, noticeId);
  if (!owner) return null;
  const officer = await requireWorkspace(db, owner.slug, cookies, now);
  if (officer.ok) return { ...owner, officer };
  if (officer.reason !== "member") return null;
  const member = await requireBoard(db, owner.slug, cookies, now);
  if (!member.ok) return null;
  return (await boardShowsNotice(db, member, noticeId, today)) ? { ...owner, officer: null } : null;
}

/** The bytes of a picture `servablePicture` let through. */
export const servedBytes = (db: Db, picture: { workspaceId: number; noticeId: number }) =>
  pictureBytes(db, picture.workspaceId, picture.noticeId);
