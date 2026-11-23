// /admin/feedback (D157, issue 713): what officers and members sent, newest first, by kind and status. Owner
// only (PIN). The text was redacted before it was stored; no sender is stored at all. A send's picture (D157
// amended 2026-11-22): its facts with the list, its bytes only for /admin/feedback/picture/[id].
import { and, desc, eq, type SQL } from "drizzle-orm";

import type { Db } from "../db";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  type FeedbackKind,
  type FeedbackStatus,
} from "../feedback-words";
import { workspaces } from "../schema";
import { feedback, feedbackPictures } from "../schema-feedback";

/** The newest rows the page shows; at most 20 a day per workspace for 180 days exist (D149). */
export const FEEDBACK_SHOWN = 200;

export interface FeedbackFilter {
  kind?: FeedbackKind;
  status?: FeedbackStatus;
}

const one = <T extends string>(list: readonly T[], v: string | string[] | undefined) =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/** `?kind=` and `?status=` as filters; anything else is no filter. */
export function feedbackFilter(q: Record<string, string | string[] | undefined>): FeedbackFilter {
  const kind = one(FEEDBACK_KINDS, q.kind);
  const status = one(FEEDBACK_STATUSES, q.status);
  return { ...(kind && { kind }), ...(status && { status }) };
}

export interface FeedbackItem {
  id: number;
  area: "desk" | "board";
  kind: FeedbackKind;
  text: string;
  path: string;
  language: string;
  tier: "officer" | "member";
  status: FeedbackStatus;
  createdAt: Date;
  /** The workspace's address; null for a public page's send. */
  workspace: string | null;
  /** The send's picture, as /admin/feedback/picture/[id] serves it; null without one. */
  picture: { src: string; width: number; height: number } | null;
}

export async function listFeedback(db: Db, filter: FeedbackFilter): Promise<FeedbackItem[]> {
  const where: SQL[] = [];
  if (filter.kind) where.push(eq(feedback.kind, filter.kind));
  if (filter.status) where.push(eq(feedback.status, filter.status));
  const rows = await db
    .select({
      id: feedback.id,
      area: feedback.area,
      kind: feedback.kind,
      text: feedback.text,
      path: feedback.path,
      language: feedback.language,
      tier: feedback.tier,
      status: feedback.status,
      createdAt: feedback.createdAt,
      workspace: workspaces.slug,
      hash: feedbackPictures.hash,
      width: feedbackPictures.width,
      height: feedbackPictures.height,
    })
    .from(feedback)
    .leftJoin(workspaces, eq(workspaces.id, feedback.workspaceId))
    .leftJoin(feedbackPictures, eq(feedbackPictures.feedbackId, feedback.id))
    .where(and(...where))
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(FEEDBACK_SHOWN);
  return rows.map(({ hash, width, height, ...item }) => ({
    ...item,
    picture:
      hash === null || width === null || height === null
        ? null
        : { src: `/admin/feedback/picture/${item.id}?v=${hash}`, width, height },
  }));
}

/** A send's picture for the owner's route: its type and hash, without the bytes; null without one. */
export async function feedbackPicture(db: Db, id: number) {
  const [row] = await db
    .select({ type: feedbackPictures.type, hash: feedbackPictures.hash })
    .from(feedbackPictures)
    .where(eq(feedbackPictures.feedbackId, id));
  return row ?? null;
}

/** The picture's bytes, read only when the route sends them (not for a 304); null once gone. */
export async function feedbackPictureBytes(db: Db, id: number) {
  const [row] = await db
    .select({ data: feedbackPictures.data })
    .from(feedbackPictures)
    .where(eq(feedbackPictures.feedbackId, id));
  return row?.data ?? null;
}
