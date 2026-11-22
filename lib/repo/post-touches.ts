// Each workspace's own line on the posts LAPTracker makes for it (#713, D156): one row per post, the latest
// text and who changed it. The Raid Shield summary is posted by the tick, outside lib/private, so it reads
// its line here, only while the workspace's `post_callouts` is on (D134's two layers).
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspacePostTouches, type PostKey } from "../schema-discord";
import { resolveFeatures } from "../workspace-features";
import { settingsById } from "./workspace-features";

const t = workspacePostTouches;

/** Every saved line of the workspace, by post (an empty line is a cleared one). */
export async function calloutsOf(db: Db, workspaceId: number): Promise<Map<PostKey, string>> {
  const rows = await db
    .select({ post: t.postKey, callout: t.callout })
    .from(t)
    .where(eq(t.workspaceId, workspaceId));
  return new Map(rows.map((r) => [r.post, r.callout]));
}

/** The post's saved line; "" when none was saved or it was cleared. */
export async function calloutOf(db: Db, workspaceId: number, post: PostKey): Promise<string> {
  const [row] = await db
    .select({ callout: t.callout })
    .from(t)
    .where(and(eq(t.workspaceId, workspaceId), eq(t.postKey, post)));
  return row?.callout ?? "";
}

/**
 * The post's line when the workspace has `post_callouts` on, else "" (the line stays stored). The line is
 * read first: with none saved, the usual case, that is the one query; the switch is read only for a line.
 */
export async function liveCallout(db: Db, workspaceId: number, post: PostKey): Promise<string> {
  const line = await calloutOf(db, workspaceId, post);
  if (!line) return "";
  const found = await settingsById(db, workspaceId);
  return found && resolveFeatures(found.settings, []).on.has("post_callouts") ? line : "";
}

/**
 * Saves the post's line; a save of the text already stored writes nothing, so it adds no activity line.
 * True when the row was written.
 */
export async function saveCallout(
  db: Db,
  row: { workspaceId: number; post: PostKey; callout: string; by: number; at: Date },
): Promise<boolean> {
  const written = await db
    .insert(t)
    .values({
      workspaceId: row.workspaceId,
      postKey: row.post,
      callout: row.callout,
      updatedBy: row.by,
      updatedAt: row.at,
    })
    .onConflictDoUpdate({
      target: [t.workspaceId, t.postKey],
      set: { callout: row.callout, updatedBy: row.by, updatedAt: row.at },
      setWhere: sql`${t.callout} is distinct from excluded.callout`,
    })
    .returning({ post: t.postKey });
  return written.length > 0;
}
