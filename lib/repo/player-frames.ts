// Each player's current avatar frame (D65), written by event snapshots and the daily read alike.
import { sql } from "drizzle-orm";

import type { Db } from "../db";
import { playerFrames } from "../schema";

type Writer = Pick<Db, "insert">;

/**
 * Keep each member's frame as the player's current one, unless a newer read already set it. `seenAt` is the
 * read's upstream `updated_at`; without one the read cannot be ordered against others, so nothing is written.
 */
export async function recordFrames(
  db: Writer,
  members: { uid: number; frameId?: number | null }[],
  seenAt: Date | null,
): Promise<void> {
  if (seenAt === null) return;
  const rows = members.flatMap((m) =>
    m.frameId == null ? [] : [{ uid: m.uid, frameId: m.frameId, seenAt }],
  );
  if (rows.length === 0) return;
  await db
    .insert(playerFrames)
    .values(rows)
    .onConflictDoUpdate({
      target: playerFrames.uid,
      set: { frameId: sql`excluded.frame_id`, seenAt: sql`excluded.seen_at` },
      setWhere: sql`${playerFrames.seenAt} <= excluded.seen_at`,
    });
}
