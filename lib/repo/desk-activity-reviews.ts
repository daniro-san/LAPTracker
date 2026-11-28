// Home's recent activity (D108): the notice review requests and their outcomes (D113), as two more parts of
// lib/repo/desk-activity.ts's small-sources union read, and their rows typed. Who, when, which notice and
// language, and the officer named: never the notice's text.
import { sql } from "drizzle-orm";

/** A review request: the notice, the language (null: all) and the officer named (null: the team). */
export interface ReviewAskedDone {
  by: number;
  at: Date;
  noticeId: number;
  language: string | null;
  reviewerId: number | null;
}

/** How a review request ended. */
export interface ReviewAnsweredDone {
  by: number;
  at: Date;
  noticeId: number;
  outcome: "approved" | "edited";
  language: string | null;
}

/** The two parts, each its own newest `n` since `since` and before `before`, in the union's columns. */
export const reviewParts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'reviewAsked', r.asked_by, r.asked_at, r.notice_id, r.language, null, null, null,
        r.reviewer_id
      from notice_reviews r
      where r.workspace_id = ${ws} and r.asked_by is not null and r.asked_at >= ${since}
        and r.asked_at < ${before} and r.deleted_at is null
      order by r.asked_at desc limit ${n})
    union all
    (select 'reviewAnswered', o.by, o.at, r.notice_id, o.outcome, r.language, null, null, null
      from notice_review_outcomes o join notice_reviews r on r.id = o.review_id
      where o.workspace_id = ${ws} and o.by is not null and o.at >= ${since}
        and o.at < ${before}
      order by o.at desc limit ${n})`;

type Row = {
  by: number;
  at: Date;
  notice_id: number | null;
  a: string | null;
  b: string | null;
  uid: number | string | null;
};

export type ReviewKind = "reviewAsked" | "reviewAnswered";

export interface ReviewRows {
  reviewsAsked: ReviewAskedDone[];
  reviewsAnswered: ReviewAnsweredDone[];
}

/** The two parts' rows, typed. */
export const reviewRows = (asked: Row[], answered: Row[]): ReviewRows => ({
  reviewsAsked: asked.map(({ by, at, notice_id, a, uid }) => ({
    by,
    at,
    noticeId: Number(notice_id),
    language: a,
    reviewerId: uid === null ? null : Number(uid),
  })),
  reviewsAnswered: answered.map(({ by, at, notice_id, a, b }) => ({
    by,
    at,
    noticeId: Number(notice_id),
    outcome: a as ReviewAnsweredDone["outcome"],
    language: b,
  })),
});
