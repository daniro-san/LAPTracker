// /admin/feedback (D157, issue 713): what officers and members sent, newest first, by kind and status. Owner
// only (PIN). The text was redacted before it was stored; no sender is stored at all.
import { and, desc, eq, type SQL } from "drizzle-orm";

import type { Db } from "../db";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  type FeedbackKind,
  type FeedbackStatus,
} from "../feedback-words";
import { workspaces } from "../schema";
import { feedback } from "../schema-feedback";

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
}

export async function listFeedback(db: Db, filter: FeedbackFilter): Promise<FeedbackItem[]> {
  const where: SQL[] = [];
  if (filter.kind) where.push(eq(feedback.kind, filter.kind));
  if (filter.status) where.push(eq(feedback.status, filter.status));
  return db
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
    })
    .from(feedback)
    .leftJoin(workspaces, eq(workspaces.id, feedback.workspaceId))
    .where(and(...where))
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(FEEDBACK_SHOWN);
}
