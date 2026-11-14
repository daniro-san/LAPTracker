// A member's picture as every query returns it: whether a photo exists and the frame around it, never a
// URL (docs/decisions/D22, D65).
import { sql } from "drizzle-orm";

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
