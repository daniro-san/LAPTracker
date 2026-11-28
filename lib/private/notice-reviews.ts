// Review requests on notices (issue 402, D113). An officer asks the whole team or one officer to look at
// the whole notice or one language. The reviewer approves it, or edits and saves it from the request, which
// closes it as "Edited by …"; the notice's earlier versions (D102) keep both texts. No comment thread. A
// request never blocks publishing and nothing is sent outside the desk. Every read and write takes the
// WorkspaceAccess, so a request is reached only from its own workspace (D71).
import { z } from "zod";

import type { Db } from "../db";
import {
  findReview,
  insertOutcome,
  insertReview,
  openReviewCount,
  openReviewsFor,
  reviewsOfNotice,
  stillOpen,
  workspaceOfficers,
  type ReviewRow,
  type Tx,
} from "../repo/notice-reviews";
import { noticeInWorkspace, noticeTitles } from "../repo/notices";
import { softDelete, undoDelete } from "../repo/trash";
import { noticeReviews as reviewTable } from "../schema-notices";
import type { WorkspaceAccess } from "./access";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "./notice-rules";

const id = z.number().int().positive();

/** POST /api/w/[slug]/notices/reviews: ask for a review, or approve one. */
export const reviewBody = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("ask"),
      notice: id,
      /** null: the whole notice. */
      language: z.enum(NOTICE_LANGUAGES).nullable(),
      /** null: anyone on the team. */
      reviewer: id.nullable(),
      requestId: z.uuid(),
    })
    .strict(),
  z.object({ action: z.literal("approve"), review: id, requestId: z.uuid() }).strict(),
  // D123 phase 2: withdraw an open request, or with `undo` take the officer's own withdraw back.
  z
    .object({
      action: z.literal("withdraw"),
      review: id,
      requestId: z.uuid(),
      undo: z.literal(true).optional(),
    })
    .strict(),
]);

/** One request as the notice page shows it. */
export interface ReviewView {
  id: number;
  language: NoticeLanguage | null;
  /** null: anyone on the team. */
  reviewerId: number | null;
  reviewer: string | null;
  askedBy: string | null;
  askedAt: Date;
  outcome: { kind: "approved" | "edited"; by: string | null; at: Date } | null;
  /** The viewer may approve it or edit from it: open, and theirs, or the team's and not asked by them. */
  mine: boolean;
}

/**
 * Who answers a request: the officer it names, or for the team's, anyone but the one who asked. The same
 * rule runs in SQL for Home (`openFor` in lib/repo/notice-reviews.ts).
 */
const mayAnswer = (r: ReviewRow, userId: number) =>
  r.reviewerId === null ? r.askedById !== userId : r.reviewerId === userId;

function viewOf(r: ReviewRow, userId: number): ReviewView {
  return {
    id: r.id,
    language: r.language as NoticeLanguage | null,
    reviewerId: r.reviewerId,
    reviewer: r.reviewer,
    askedBy: r.askedBy,
    askedAt: r.askedAt,
    outcome: r.outcome && r.outcomeAt && { kind: r.outcome, by: r.outcomeBy, at: r.outcomeAt },
    mine: r.outcome === null && mayAnswer(r, userId),
  };
}

/** The officers a request can name, without the one asking. */
export async function reviewers(db: Db, access: WorkspaceAccess) {
  const officers = await workspaceOfficers(db, access.workspaceId);
  return officers.filter((o) => o.id !== access.user.id);
}

export type AskResult = { ok: true; id: number } | { ok: false; reason: "not_found" | "reviewer" };

export async function askReview(
  db: Db,
  access: WorkspaceAccess,
  ask: { notice: number; language: NoticeLanguage | null; reviewer: number | null },
  requestId: string,
  now: Date,
): Promise<AskResult> {
  if (!(await noticeInWorkspace(db, access.workspaceId, ask.notice))) {
    return { ok: false, reason: "not_found" };
  }
  if (ask.reviewer !== null && !(await reviewers(db, access)).some((o) => o.id === ask.reviewer)) {
    return { ok: false, reason: "reviewer" };
  }
  const made = await insertReview(db, {
    workspaceId: access.workspaceId,
    noticeId: ask.notice,
    requestId,
    language: ask.language,
    reviewerId: ask.reviewer,
    askedBy: access.user.id,
    at: now,
  });
  return { ok: true, id: made };
}

export type AnswerResult = "ok" | "not_found" | "not_reviewer" | "closed";

/**
 * Approves the request, or closes it as edited after a save from it. `notice`: the notice that was saved,
 * which must be the request's.
 */
export async function answerReview(
  db: Tx,
  access: WorkspaceAccess,
  answer: { review: number; outcome: "approved" | "edited"; notice?: number },
  requestId: string,
  now: Date,
): Promise<AnswerResult> {
  const r = await findReview(db, access.workspaceId, answer.review);
  if (!r || (answer.notice !== undefined && r.noticeId !== answer.notice)) return "not_found";
  if (!mayAnswer(r, access.user.id)) return "not_reviewer";
  return insertOutcome(db, {
    workspaceId: access.workspaceId,
    reviewId: r.id,
    requestId,
    outcome: answer.outcome,
    by: access.user.id,
    at: now,
  });
}

/**
 * Withdraws an open request of the workspace (D123 phase 2): any officer, as every delete at the desk; or
 * with `undo` takes the officer's own withdraw made under the same request id back within UNDO_MS.
 * "not_found": no such open request, or nothing of this officer's to undo.
 */
export async function withdrawReview(
  db: Db,
  access: WorkspaceAccess,
  input: { review: number; requestId: string; undo?: true | undefined },
  now: Date,
): Promise<"ok" | "not_found"> {
  const { workspaceId, user } = access;
  const c = { workspaceId, userId: user.id, now, id: input.review, requestId: input.requestId };
  const done = input.undo
    ? await undoDelete(db, reviewTable, c)
    : await softDelete(db, reviewTable, c, stillOpen);
  return done ? "ok" : "not_found";
}

/** A notice's requests, newest first, as the viewer sees them, and the officers a new one can name. */
export async function noticeReviews(db: Db, access: WorkspaceAccess, noticeId: number) {
  const [rows, officers] = await Promise.all([
    reviewsOfNotice(db, access.workspaceId, noticeId),
    reviewers(db, access),
  ]);
  return { list: rows.map((r): ReviewView => viewOf(r, access.user.id)), officers };
}

/** How many requests wait for the viewer, for the Home tab's number (D113): one count in SQL. */
export const reviewsForMeCount = (db: Db, access: WorkspaceAccess) =>
  openReviewCount(db, access.workspaceId, access.user.id);

/** Home's "To review" (D113): every open request the viewer may answer, with the notice's title. */
export async function reviewsForMe(db: Db, access: WorkspaceAccess) {
  const open = await openReviewsFor(db, access.workspaceId, access.user.id);
  const titles = await noticeTitles(db, access.workspaceId, [
    ...new Set(open.map((r) => r.noticeId)),
  ]);
  return open.map((r) => ({
    id: r.id,
    noticeId: r.noticeId,
    title: titles.get(r.noticeId) ?? "",
    language: r.language as NoticeLanguage | null,
    askedBy: r.askedBy,
    /** Named for this officer; else a team request. */
    forMe: r.reviewerId === access.user.id,
  }));
}
