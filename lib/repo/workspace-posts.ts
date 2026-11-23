// The catalog posts' rows (#713 part C, D159): each workspace's settings per post (`workspace_posts`), and the
// claim per workspace, post and period that makes a post go out at most once (`post_runs`). Plain reads and
// writes; what a post says, and whether the owner allows it, stay in lib/private/catalog-posts.ts.
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { postRuns, workspacePosts, type CatalogPost } from "../schema-discord";

const p = workspacePosts;
const r = postRuns;

export type PostRow = typeof workspacePosts.$inferSelect;

/** A failed send that reached Discord with nothing is tried again by a later tick, up to this many times. */
export const POST_ATTEMPTS = 3;

/** Every saved post of the workspace, by post. */
export async function postsOf(db: Db, workspaceId: number): Promise<Map<CatalogPost, PostRow>> {
  const rows = await db.select().from(p).where(eq(p.workspaceId, workspaceId));
  return new Map(rows.map((row) => [row.postKey, row]));
}

export type PostValues = Pick<
  PostRow,
  "on" | "channel" | "weekday" | "title" | "picture" | "language"
>;

/**
 * Saves the post's settings. The row as it was before (null: none), so the caller can tell a switch turned
 * on or off from a settings change; a save of the values already stored writes nothing.
 */
export async function savePost(
  db: Db,
  row: { workspaceId: number; post: CatalogPost; values: PostValues; by: number; at: Date },
): Promise<{ before: PostRow | null; written: boolean }> {
  const [before] = await db
    .select()
    .from(p)
    .where(and(eq(p.workspaceId, row.workspaceId), eq(p.postKey, row.post)));
  const set = { ...row.values, updatedBy: row.by, updatedAt: row.at };
  const written = await db
    .insert(p)
    .values({ workspaceId: row.workspaceId, postKey: row.post, ...set })
    .onConflictDoUpdate({
      target: [p.workspaceId, p.postKey],
      set,
      setWhere: sql`(${p.on}, ${p.channel}, ${p.weekday}, ${p.title}, ${p.picture}, ${p.language})
        is distinct from (excluded.on, excluded.channel, excluded.weekday, excluded.title,
        excluded.picture, excluded.language)`,
    })
    .returning({ post: p.postKey });
  return { before: before ?? null, written: written.length > 0 };
}

/**
 * The workspaces whose post is on and has no claim for `period` yet, or only a failed one that reached
 * Discord with nothing and has attempts left: what a tick may send now.
 */
export async function postsDue(db: Db, post: CatalogPost, period: string) {
  return db
    .select({
      workspaceId: p.workspaceId,
      slug: workspaces.slug,
      unionId: workspaces.unionId,
      channel: p.channel,
      title: p.title,
      language: p.language,
    })
    .from(p)
    .innerJoin(workspaces, eq(workspaces.id, p.workspaceId))
    .leftJoin(r, and(eq(r.workspaceId, p.workspaceId), eq(r.postKey, post), eq(r.period, period)))
    .where(
      and(
        eq(p.postKey, post),
        eq(p.on, true),
        sql`(${r.status} is null or (${r.status} = 'failed' and ${r.sent} = 0 and ${r.attempts} < ${POST_ATTEMPTS}))`,
      ),
    );
}

/**
 * INVARIANT posts.once-per-period: the claim of one post's period for one workspace. True for exactly one
 * caller, however many ticks overlap: the insert, or the retake of a claim Discord refused before any message
 * went through (with attempts left), both one statement. An unanswered send is never retaken.
 */
export async function claimPostRun(
  db: Db,
  run: { workspaceId: number; post: CatalogPost; period: string; at: Date },
): Promise<boolean> {
  const claimed = await db
    .insert(r)
    .values({
      workspaceId: run.workspaceId,
      postKey: run.post,
      period: run.period,
      status: "posting",
      at: run.at,
    })
    .onConflictDoUpdate({
      target: [r.workspaceId, r.postKey, r.period],
      set: { status: "posting", attempts: sql`${r.attempts} + 1`, at: run.at },
      setWhere: sql`${r.status} = 'failed' and ${r.sent} = 0 and ${r.attempts} < ${POST_ATTEMPTS}`,
    })
    .returning({ period: r.period });
  return claimed.length > 0;
}

/**
 * A period with nothing to post (a week with no entry for members): settled as `skipped`, so the later ticks
 * of the period read nothing more for it. A claim already there stays as it is.
 */
export async function settlePostRun(
  db: Db,
  run: { workspaceId: number; post: CatalogPost; period: string; at: Date },
): Promise<void> {
  await db
    .insert(r)
    .values({
      workspaceId: run.workspaceId,
      postKey: run.post,
      period: run.period,
      status: "skipped",
      attempts: 0,
      at: run.at,
    })
    .onConflictDoNothing();
}

/**
 * The claim's outcome: posted; failed (Discord answered with an error) or unanswered (no answer: it may have
 * posted, so it is never tried again), with how many messages Discord took.
 */
export async function finishPostRun(
  db: Db,
  run: { workspaceId: number; post: CatalogPost; period: string },
  done: { status: "posted" | "failed" | "unanswered"; sent: number },
): Promise<void> {
  await db
    .update(r)
    .set(done)
    .where(
      and(eq(r.workspaceId, run.workspaceId), eq(r.postKey, run.post), eq(r.period, run.period)),
    );
}
