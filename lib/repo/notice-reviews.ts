// notice_reviews and notice_review_outcomes (D113): a review request is stored once under the ask sheet's
// request id, and closed by its first outcome. Neither table is ever updated. Also the workspace's officers,
// the people a request can name.
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import type { Db } from "../db";
import { workspaceSessions, workspaceUsers } from "../schema";
import { noticeReviewOutcomes, noticeReviews } from "../schema-notices";

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

const asker = alias(workspaceUsers, "asker");
const reviewer = alias(workspaceUsers, "reviewer");
const closer = alias(workspaceUsers, "closer");
const shown = (u: { chosenName: AnyPgColumn; displayName: AnyPgColumn }) =>
  sql<string | null>`coalesce(${u.chosenName}, ${u.displayName})`;

/** The workspace's requests with their outcome and the three names; `where` narrows them. */
function reviewRows(db: Db, workspaceId: number, where: SQL) {
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
    .leftJoin(noticeReviewOutcomes, eq(noticeReviewOutcomes.reviewId, noticeReviews.id))
    .leftJoin(asker, eq(asker.id, noticeReviews.askedBy))
    .leftJoin(reviewer, eq(reviewer.id, noticeReviews.reviewerId))
    .leftJoin(closer, eq(closer.id, noticeReviewOutcomes.by))
    .where(and(eq(noticeReviews.workspaceId, workspaceId), where))
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
  db: Db,
  workspaceId: number,
  id: number,
): Promise<ReviewRow | null> {
  const [row] = await reviewRows(db, workspaceId, eq(noticeReviews.id, id));
  return row ?? null;
}

/** A notice's requests, newest first: the open ones and the newest answered ones. */
export const reviewsOfNotice = (db: Db, workspaceId: number, noticeId: number) =>
  reviewRows(db, workspaceId, eq(noticeReviews.noticeId, noticeId)).limit(20);

/** Every open request of the workspace, newest first. */
export const openReviews = (db: Db, workspaceId: number) =>
  reviewRows(db, workspaceId, isNull(noticeReviewOutcomes.id)).limit(100);

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
 * "closed": another outcome closed it first.
 */
export async function insertOutcome(db: Db, o: NewOutcome): Promise<"ok" | "closed"> {
  const made = await db
    .insert(noticeReviewOutcomes)
    .values(o)
    .onConflictDoNothing()
    .returning({ id: noticeReviewOutcomes.id });
  if (made.length > 0) return "ok";
  const [first] = await db
    .select({ requestId: noticeReviewOutcomes.requestId })
    .from(noticeReviewOutcomes)
    .where(eq(noticeReviewOutcomes.reviewId, o.reviewId));
  return first?.requestId === o.requestId ? "ok" : "closed";
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
