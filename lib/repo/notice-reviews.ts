// notice_reviews and notice_review_outcomes (D113): a review request is stored once under the ask sheet's
// request id, and closed by its first outcome. An open request can be withdrawn (D123 phase 2, the shared
// soft delete); nothing else updates either table. Also the workspace's officers, the people a request can
// name.
import { and, count, desc, eq, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import type { Db } from "../db";
import { workspaceSessions, workspaceUsers } from "../schema";
import { noticeReviewOutcomes, noticeReviews, notices } from "../schema-notices";
import { live } from "./trash";

/** Only an open request is withdrawn: one with an outcome is history (D123 phase 2). */
export const stillOpen = sql`not exists (select 1 from notice_review_outcomes o
  where o.review_id = ${noticeReviews.id})`;

export interface ReviewRow {
  id: number;
  noticeId: number;
  /** null: the whole notice. */
  language: string | null;
  /** null: anyone on the team. */
  reviewerId: number | null;
  reviewer: string | null;
  askedById: number | null;
  askedBy: string | null;
  askedAt: Date;
  outcome: "approved" | "edited" | null;
  outcomeBy: string | null;
  outcomeAt: Date | null;
}

/** A save's transaction or the database: the outcome of an edit is written in the save's (D113). */
export type Tx = Pick<Db, "select" | "insert" | "execute">;

/** The request's notice, not deleted (D118): a deleted notice's requests leave every list. */
const ofLiveNotice = and(eq(notices.id, noticeReviews.noticeId), isNull(notices.deletedAt));

const asker = alias(workspaceUsers, "asker");
const reviewer = alias(workspaceUsers, "reviewer");
const closer = alias(workspaceUsers, "closer");
const shown = (u: { chosenName: AnyPgColumn; displayName: AnyPgColumn }) =>
  sql<string | null>`coalesce(${u.chosenName}, ${u.displayName})`;

/** The workspace's requests with their outcome and the three names; `where` narrows them. */
function reviewRows(db: Tx, workspaceId: number, where: SQL) {
  return db
    .select({
      id: noticeReviews.id,
      noticeId: noticeReviews.noticeId,
      language: noticeReviews.language,
      reviewerId: noticeReviews.reviewerId,
      reviewer: shown(reviewer),
      askedById: noticeReviews.askedBy,
      askedBy: shown(asker),
      askedAt: noticeReviews.askedAt,
      outcome: noticeReviewOutcomes.outcome,
      outcomeBy: shown(closer),
      outcomeAt: noticeReviewOutcomes.at,
    })
    .from(noticeReviews)
    .innerJoin(notices, ofLiveNotice)
    .leftJoin(noticeReviewOutcomes, eq(noticeReviewOutcomes.reviewId, noticeReviews.id))
    .leftJoin(asker, eq(asker.id, noticeReviews.askedBy))
    .leftJoin(reviewer, eq(reviewer.id, noticeReviews.reviewerId))
    .leftJoin(closer, eq(closer.id, noticeReviewOutcomes.by))
    .where(and(eq(noticeReviews.workspaceId, workspaceId), live(noticeReviews), where))
    .orderBy(desc(noticeReviews.id));
}

export interface NewReview {
  workspaceId: number;
  noticeId: number;
  requestId: string;
  language: string | null;
  reviewerId: number | null;
  askedBy: number;
  at: Date;
}

/** Stores the request once: a repeat of its request id (D100) answers the first one's id. */
export async function insertReview(db: Db, r: NewReview): Promise<number> {
  const { at, ...row } = r;
  await db
    .insert(noticeReviews)
    .values({ ...row, askedAt: at })
    .onConflictDoNothing({ target: [noticeReviews.workspaceId, noticeReviews.requestId] });
  const [made] = await db
    .select({ id: noticeReviews.id })
    .from(noticeReviews)
    .where(
      and(eq(noticeReviews.workspaceId, r.workspaceId), eq(noticeReviews.requestId, r.requestId)),
    );
  if (!made) throw new Error("review_insert_lost");
  return made.id;
}

export async function findReview(
  db: Tx,
  workspaceId: number,
  id: number,
): Promise<ReviewRow | null> {
  const [row] = await reviewRows(db, workspaceId, eq(noticeReviews.id, id));
  return row ?? null;
}

/** How many answered requests a notice lists; its open requests are always all listed. */
export const ANSWERED_SHOWN = 20;

/** A notice's requests, newest first: every open one, and the newest ANSWERED_SHOWN answered ones. */
export async function reviewsOfNotice(db: Db, workspaceId: number, noticeId: number) {
  const ofNotice = eq(noticeReviews.noticeId, noticeId);
  const [open, answered] = await Promise.all([
    reviewRows(db, workspaceId, and(ofNotice, isNull(noticeReviewOutcomes.id)) as SQL),
    reviewRows(db, workspaceId, and(ofNotice, isNotNull(noticeReviewOutcomes.id)) as SQL).limit(
      ANSWERED_SHOWN,
    ),
  ]);
  return [...open, ...answered].sort((a, b) => b.id - a.id);
}

/**
 * An open request `userId` may answer: named for them, or for the team when someone else asked (a request
 * whose asker's account is gone counts for everyone).
 */
const openFor = (userId: number) =>
  and(
    isNull(noticeReviewOutcomes.id),
    or(
      eq(noticeReviews.reviewerId, userId),
      and(
        isNull(noticeReviews.reviewerId),
        or(isNull(noticeReviews.askedBy), ne(noticeReviews.askedBy, userId)),
      ),
    ),
  ) as SQL;

/** Every open request `userId` may answer, newest first (Home's "To review"). */
export const openReviewsFor = (db: Db, workspaceId: number, userId: number) =>
  reviewRows(db, workspaceId, openFor(userId));

/** How many open requests `userId` may answer: the Home tab's number, on every page. */
export async function openReviewCount(db: Db, workspaceId: number, userId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(noticeReviews)
    .innerJoin(notices, ofLiveNotice)
    .leftJoin(noticeReviewOutcomes, eq(noticeReviewOutcomes.reviewId, noticeReviews.id))
    .where(and(eq(noticeReviews.workspaceId, workspaceId), live(noticeReviews), openFor(userId)));
  return row?.n ?? 0;
}

export interface NewOutcome {
  workspaceId: number;
  reviewId: number;
  requestId: string;
  outcome: "approved" | "edited";
  by: number;
  at: Date;
}

/**
 * Closes the request. "ok": this outcome is stored, now or by an earlier try with the same request id.
 * "closed": another outcome closed it first. "not_found": the request was withdrawn and has no outcome.
 */
export async function insertOutcome(db: Tx, o: NewOutcome): Promise<"ok" | "closed" | "not_found"> {
  // Only while the request is not withdrawn, checked in the insert's own statement (D123 phase 2): a
  // withdraw committed after the caller's read is seen here.
  const made = await db.execute(sql`insert into notice_review_outcomes
      (workspace_id, review_id, request_id, outcome, "by", "at")
    select ${o.workspaceId}, ${o.reviewId}, ${o.requestId}, ${o.outcome}, ${o.by}, ${o.at}
    where exists (select 1 from notice_reviews r
      where r.id = ${o.reviewId} and r.workspace_id = ${o.workspaceId} and r.deleted_at is null)
    on conflict do nothing
    returning id`);
  if (made.rows.length > 0) return "ok";
  const [first] = await db
    .select({ requestId: noticeReviewOutcomes.requestId })
    .from(noticeReviewOutcomes)
    .where(eq(noticeReviewOutcomes.reviewId, o.reviewId));
  if (!first) return "not_found";
  return first.requestId === o.requestId ? "ok" : "closed";
}

/** The workspace's officers: everyone with an officer session on record and not blocked, by name. */
export async function workspaceOfficers(
  db: Db,
  workspaceId: number,
): Promise<{ id: number; name: string | null }[]> {
  const rows = await db
    .selectDistinct({ id: workspaceUsers.id, name: shown(workspaceUsers) })
    .from(workspaceUsers)
    .innerJoin(
      workspaceSessions,
      and(
        eq(workspaceSessions.workspaceUserId, workspaceUsers.id),
        eq(workspaceSessions.tier, "officer"),
      ),
    )
    .where(and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.blocked, false)));
  return rows.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.id - b.id);
}
