// A member's picture as every query returns it: whether a photo exists and the frame around it, never a
// URL (docs/decisions/D22, D65).
import { sql } from "drizzle-orm";

import { memberSnapshots } from "../schema";

export interface Photo {
  /** /img/avatar/[uid] has a photo to serve. */
  hasAvatar: boolean;
  /** The avatar frame's id, served by /img/frame/[id]; null on rows stored before frames. */
  frameId: number | null;
}

/** The member_snapshots columns behind `Photo`. */
export const photoColumns = {
  hasAvatar: sql<boolean>`${memberSnapshots.avatarUrl} is not null`,
  frameId: memberSnapshots.frameId,
};
