// A member's picture as every query returns it: whether a photo exists and the frame around it, never a
// URL (docs/decisions/D22, D65).
import { desc, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { memberSnapshots } from "../schema";

export interface Photo {
  /** /img/avatar/[uid] has a photo to serve. */
  hasAvatar: boolean;
  /** The player's current avatar frame (newest read, D65), served by /img/frame/[id]; null when none is known. */
  frameId: number | null;
}

/** The member_snapshots columns behind `Photo`. */
export const photoColumns = {
  hasAvatar: sql<boolean>`${memberSnapshots.avatarUrl} is not null`,
  // Both sides qualified by hand: a select from member_snapshots alone renders its columns unqualified,
  // and a bare "uid" inside the subquery would then mean player_frames.uid.
  frameId: sql<
    number | null
  >`(select pf.frame_id from player_frames pf where pf.uid = "member_snapshots"."uid")`,
};

/** Per uid, the photo and frame of the player's newest roster row, as every public page shows them; a uid
 * with no roster row has none. Booleans and frame ids only (D22, D65, D66). */
export async function photosOf(db: Db, uids: number[]): Promise<Map<number, Photo>> {
  if (uids.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([memberSnapshots.uid], { uid: memberSnapshots.uid, ...photoColumns })
    .from(memberSnapshots)
    .where(inArray(memberSnapshots.uid, uids))
    .orderBy(memberSnapshots.uid, desc(memberSnapshots.id));
  return new Map(rows.map((r) => [r.uid, { hasAvatar: r.hasAvatar, frameId: r.frameId }]));
}
