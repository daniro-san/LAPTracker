// The notice pictures the weekly cleanup will delete soon (D119, owner 2026-11-18): Home's warning card and
// the review list (thumbnail, title, the day after which it may go), and the list's actions: Keep (never
// cleaned, who and when), stop keeping, and "Use in another notice" (a copy with its own clock). Every read
// and write takes the WorkspaceAccess.
import type { Db } from "../db";
import {
  copyPicture,
  deletableFrom,
  duePictures,
  keptBy,
  setKept,
  shiftDay,
} from "../repo/notice-picture-cleanup";
import { noticeTitles } from "../repo/notices";
import { serverDay, type ScheduleConfig } from "../schedule";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";
import { pictureView, type PictureView } from "./notice-picture-rules";

export interface DueItem {
  noticeId: number;
  title: string;
  picture: PictureView;
  /** The cleanup may delete it after this server day (YYYY-MM-DD). */
  after: string;
}

/** The workspace's pictures due within 7 days and not kept, the soonest first. */
export async function picturesDue(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  cfg: Pick<ScheduleConfig, "SERVER_TZ">,
): Promise<DueItem[]> {
  // D126: none while notices or their pictures are turned off for the alliance (the pictures stay).
  if (!featureOn(access, "notices") || !featureOn(access, "notice_pictures")) return [];
  const today = serverDay(now, cfg);
  const due = await duePictures(db, access.workspaceId, today);
  const titles = await noticeTitles(db, access.workspaceId, [
    ...new Set(due.map((d) => d.noticeId)),
  ]);
  return due
    .map((d) => {
      const warned = d.warnedAt ? serverDay(d.warnedAt, cfg) : null;
      return {
        noticeId: d.noticeId,
        title: titles.get(d.noticeId) ?? "",
        picture: pictureView(d),
        after: shiftDay(deletableFrom(d, warned, today), -1),
      };
    })
    .sort((a, b) => a.after.localeCompare(b.after) || a.noticeId - b.noticeId);
}

/** Keep the notice's picture (never cleaned), or stop keeping it; null when the notice has no picture. */
export const keepPicture = (
  db: Db,
  access: WorkspaceAccess,
  noticeId: number,
  keep: boolean,
  now: Date,
) => setKept(db, access.workspaceId, noticeId, keep ? { by: access.user.id, at: now } : null);

/** Who kept the notice's picture and when, for the editor's "Kept" mark; null when it is not kept. */
export const pictureKept = (db: Db, access: WorkspaceAccess, noticeId: number) =>
  keptBy(db, access.workspaceId, noticeId);

/** "Use in another notice": copies `from`'s picture to the live notice `to`; null when either is missing. */
export const reusePicture = (
  db: Db,
  access: WorkspaceAccess,
  from: number,
  to: number,
  now: Date,
) => copyPicture(db, access.workspaceId, from, to, access.user.id, now);
